import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { updatePreviewRecord } from '../cache/cacheIndex';
import { toQaSummaryMarkdown } from '../qa/reporter';
import { analyzeVsdx } from '../qa/vsdxParser';
import { CacheIndex, QaResult, RadarConfig } from '../types';

const CONFIG: RadarConfig = {
  pwshPath: 'pwsh',
  outputDirectory: '.aifde',
  previewFormat: 'png',
  qaPreset: 'custom',
  autoExportOnSave: false,
  exportTimeoutMs: 120000,
  shapeDensityWarningThreshold: 80,
  connectorRatioWarningThreshold: 0.25,
  pageCoverageLowWarningThreshold: 0.02,
  pageCoverageHighWarningThreshold: 0.85,
  enableShapeDensityWarning: true,
  enableConnectorRatioWarning: true,
  enableUnlabeledShapeWarning: true,
  enablePageCoverageWarning: true,
  enableDiagonalConnectorWarning: true,
  enableConnectorCrossingWarning: true,
  enableDanglingConnectorWarning: true,
  enableShapeOverlapWarning: true
};

interface EvidenceItem {
  sourcePath: string;
  qaPath: string;
  summaryPath: string;
  previewPath?: string;
  riskCount: number;
}

async function main(): Promise<void> {
  const root = path.resolve(__dirname, '..', '..');
  const fixtureDir = path.join(root, 'test', 'fixtures');
  const previewDir = path.join(root, '.aifde', 'previews');
  const qaDir = path.join(root, '.aifde', 'qa');
  const fixtures = (await fs.readdir(fixtureDir))
    .filter(name => name.toLowerCase().endsWith('.vsdx'))
    .sort()
    .map(name => path.join(fixtureDir, name));

  if (fixtures.length === 0) {
    throw new Error(`No VSDX fixtures found in ${fixtureDir}`);
  }

  await fs.mkdir(qaDir, { recursive: true });
  const cacheIndex: CacheIndex = { version: 1, records: {} };
  const items: EvidenceItem[] = [];

  for (const sourcePath of fixtures) {
    const previewPath = await findPreviewPath(sourcePath, previewDir);
    const qaPath = resolveQaPath(sourcePath, qaDir);
    const summaryPath = resolveQaSummaryPath(qaPath);
    if (previewPath) {
      const previewPaths = await findPreviewPaths(sourcePath, previewDir);
      await updatePreviewRecord(cacheIndex, sourcePath, previewPath, 'png', qaPath, previewPaths, previewPaths.length);
    }

    const result = await analyzeVsdx(sourcePath, previewPath, cacheIndex, CONFIG);
    assertQaEvidence(result, qaPath, summaryPath);
    await fs.writeFile(qaPath, JSON.stringify(result, null, 2), 'utf8');
    await fs.writeFile(summaryPath, toQaSummaryMarkdown(result), 'utf8');
    items.push({
      sourcePath,
      qaPath,
      summaryPath,
      previewPath,
      riskCount: result.risks.length
    });
  }

  await checkWrittenEvidence(items);
  process.stdout.write(JSON.stringify({
    success: true,
    fixtureCount: fixtures.length,
    qaJsonCount: items.length,
    qaMarkdownCount: items.length,
    qaDir,
    riskCount: items.reduce((sum, item) => sum + item.riskCount, 0)
  }, null, 2));
}

async function findPreviewPath(sourcePath: string, previewDir: string): Promise<string | undefined> {
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const candidates = [
    path.join(previewDir, `${baseName}.test.png`),
    path.join(previewDir, `${baseName}.png`)
  ];
  return candidates.find(candidate => existsSync(candidate));
}

async function findPreviewPaths(sourcePath: string, previewDir: string): Promise<string[]> {
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const primary = await findPreviewPath(sourcePath, previewDir);
  if (!primary) {
    return [];
  }

  const pagePattern = new RegExp(`^${escapeRegExp(baseName)}\\.page-\\d+\\.png$`, 'i');
  const pagePreviews = (await fs.readdir(previewDir))
    .filter(name => pagePattern.test(name))
    .sort()
    .map(name => path.join(previewDir, name));
  return [primary, ...pagePreviews];
}

function assertQaEvidence(result: QaResult, qaPath: string, summaryPath: string): void {
  const missingFields = [
    result.sourcePath ? undefined : 'sourcePath',
    result.sourceMtimeMs === undefined ? 'sourceMtimeMs' : undefined,
    result.sourceModifiedAt ? undefined : 'sourceModifiedAt',
    result.generatedAt ? undefined : 'generatedAt',
    result.previewPath ? undefined : 'previewPath',
    result.previewFreshnessReasons ? undefined : 'previewFreshnessReasons',
    result.stats?.pageCount === undefined ? 'stats.pageCount' : undefined,
    result.stats?.shapeCount === undefined ? 'stats.shapeCount' : undefined,
    result.stats?.connectCount === undefined ? 'stats.connectCount' : undefined,
    result.risks ? undefined : 'risks'
  ].filter((field): field is string => field !== undefined);

  if (missingFields.length > 0) {
    throw new Error(`QA evidence for ${result.sourcePath || qaPath} is missing fields: ${missingFields.join(', ')}`);
  }
  if (!qaPath.endsWith('.qa.json') || !summaryPath.endsWith('.qa.md')) {
    throw new Error(`QA evidence paths use unexpected extensions: ${qaPath}, ${summaryPath}`);
  }
}

async function checkWrittenEvidence(items: EvidenceItem[]): Promise<void> {
  for (const item of items) {
    if (!existsSync(item.qaPath)) {
      throw new Error(`QA JSON was not written: ${item.qaPath}`);
    }
    if (!existsSync(item.summaryPath)) {
      throw new Error(`QA Markdown was not written: ${item.summaryPath}`);
    }

    const parsed = JSON.parse(await fs.readFile(item.qaPath, 'utf8')) as QaResult;
    assertQaEvidence(parsed, item.qaPath, item.summaryPath);
    const markdown = await fs.readFile(item.summaryPath, 'utf8');
    for (const requiredSection of ['# AI-FDE VSDX QA Summary', '## Preview Freshness', '## Stats', '## Pages', '## Risks']) {
      if (!markdown.includes(requiredSection)) {
        throw new Error(`QA Markdown is missing ${requiredSection}: ${item.summaryPath}`);
      }
    }
  }
}

function resolveQaPath(filePath: string, qaDir: string): string {
  return path.join(qaDir, `${safeBaseName(filePath)}.${shortHash(filePath)}.qa.json`);
}

function resolveQaSummaryPath(qaJsonPath: string): string {
  return qaJsonPath.replace(/\.qa\.json$/i, '.qa.md');
}

function safeBaseName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath)).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

function shortHash(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 8);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch(error => {
  process.stderr.write(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
