import * as fs from 'fs/promises';
import * as path from 'path';
import { hashFile } from '../cache/cacheIndex';
import { analyzeVsdx } from '../qa/vsdxParser';
import { CacheIndex, RadarConfig } from '../types';

async function main(): Promise<void> {
  const root = path.resolve(__dirname, '..', '..');
  const fixturePath = path.join(root, 'test', 'fixtures', 'visio-com-smoke.vsdx');
  const previewPath = path.join(root, '.aifde', 'previews', 'visio-com-smoke.png');
  const [sourceStat, previewStat, sourceHash] = await Promise.all([
    fs.stat(fixturePath),
    fs.stat(previewPath),
    hashFile(fixturePath)
  ]);

  const cacheIndex: CacheIndex = {
    version: 1,
    records: {
      [fixturePath]: {
        sourcePath: fixturePath,
        sourceMtimeMs: sourceStat.mtimeMs,
        sourceSize: sourceStat.size,
        sourceHash,
        previewPath,
        previewPaths: [previewPath],
        previewMtimeMs: previewStat.mtimeMs,
        previewSize: previewStat.size,
        format: 'png',
        exportedPageCount: 1,
        updatedAt: new Date().toISOString()
      }
    }
  };

  const config: RadarConfig = {
    pwshPath: 'pwsh',
    outputDirectory: '.aifde',
    previewFormat: 'png',
    qaPreset: 'custom',
    autoExportOnSave: false,
    exportTimeoutMs: 120000,
    convertTimeoutMs: 300000,
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

  const result = await analyzeVsdx(fixturePath, previewPath, cacheIndex, config);
  assert(result.stats.pageCount === 1, 'expected one Visio-generated page');
  assert(result.stats.shapeCount >= 3, 'expected at least three Visio-generated shapes');
  assert(result.stats.textShapeCount >= 2, 'expected at least two text-bearing shapes');
  assert(result.stats.unlabeledShapeCount === 0, 'expected no unlabeled non-connector shapes');
  assert(result.stats.connectCount >= 2, 'expected connector relationships');
  assert(result.stats.outOfBoundsShapeCount === 0, 'expected no out-of-bounds shapes');
  assert(result.stats.diagonalConnectorCount === 0, 'expected no diagonal connector');
  assert(result.stats.connectorCrossingCount === 0, 'expected no connector crossing');
  assert(result.stats.danglingConnectorCount === 0, 'expected no dangling connector');
  assert(result.stats.averagePageCoverageRatio !== undefined && result.stats.averagePageCoverageRatio > 0, 'expected average page coverage');
  assert(result.pages[0]?.width !== undefined, 'expected page width');
  assert(result.pages[0]?.height !== undefined, 'expected page height');
  assert(result.previewPaths?.length === 1, 'expected one recorded preview path');

  console.log(JSON.stringify({
    ok: true,
    fixturePath,
    previewPath,
    stats: result.stats,
    page: result.pages[0],
    risks: result.risks
  }, null, 2));
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
