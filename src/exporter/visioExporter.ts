import * as cp from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { PreviewExportResult, RadarConfig } from '../types';

const execFile = promisify(cp.execFile);

export async function exportVisioPreview(
  extensionRoot: string,
  inputPath: string,
  outputPath: string,
  config: RadarConfig
): Promise<PreviewExportResult> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const scriptPath = path.join(extensionRoot, 'scripts', 'export-visio.ps1');
  const startedAt = Date.now();
  const args = [
    '-NoLogo',
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-STA',
    '-File',
    scriptPath,
    '-InputPath',
    inputPath,
    '-OutputPath',
    outputPath,
    '-Format',
    config.previewFormat
  ];

  try {
    const { stdout } = await execFile(config.pwshPath, args, {
      timeout: config.exportTimeoutMs,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    const parsed = parseExporterJson(stdout);
    return {
      ...parsed,
      command: `${config.pwshPath} ${args.join(' ')}`,
      durationMs: parsed.durationMs ?? Date.now() - startedAt
    };
  } catch (error) {
    const err = error as cp.ExecFileException & { stdout?: string; stderr?: string };
    const parsed = err.stdout ? tryParseExporterJson(err.stdout) : undefined;
    if (parsed) {
      return {
        ...parsed,
        success: false,
        command: `${config.pwshPath} ${args.join(' ')}`
      };
    }

    return {
      success: false,
      inputPath,
      outputPath,
      format: config.previewFormat,
      durationMs: Date.now() - startedAt,
      error: [err.message, err.stderr].filter(Boolean).join('\n'),
      errorType: err.killed ? 'Timeout' : 'ProcessError',
      command: `${config.pwshPath} ${args.join(' ')}`
    };
  }
}

function parseExporterJson(stdout: string): PreviewExportResult {
  const parsed = tryParseExporterJson(stdout);
  if (!parsed) {
    throw new Error(`Visio exporter did not return JSON. Output: ${stdout}`);
  }
  return parsed;
}

function tryParseExporterJson(stdout: string): PreviewExportResult | undefined {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return undefined;
  }

  const lines = trimmed.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].startsWith('{')) {
      continue;
    }
    try {
      return JSON.parse(lines[i]) as PreviewExportResult;
    } catch {
      // Keep looking for the final structured line.
    }
  }
  return undefined;
}
