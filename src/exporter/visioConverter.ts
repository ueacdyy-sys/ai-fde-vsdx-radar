import * as cp from 'child_process';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { RadarConfig, VisioConvertResult } from '../types';

const execFile = promisify(cp.execFile);

export type ModernVisioConversionExtension = '.vsdx' | '.vssx' | '.vstx';

export function getModernVisioConversionExtension(inputPath: string): ModernVisioConversionExtension {
  const extension = path.extname(inputPath).toLowerCase();
  if (extension === '.vss') {
    return '.vssx';
  }
  if (extension === '.vst') {
    return '.vstx';
  }
  return '.vsdx';
}

export function resolveModernVisioConversionOutputPath(inputPath: string, exists: (candidate: string) => boolean = existsSync): string {
  const outputExtension = getModernVisioConversionExtension(inputPath);
  const directory = path.dirname(inputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const firstCandidate = path.join(directory, `${baseName}.converted${outputExtension}`);
  if (!exists(firstCandidate)) {
    return firstCandidate;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = path.join(directory, `${baseName}.converted-${index}${outputExtension}`);
    if (!exists(candidate)) {
      return candidate;
    }
  }

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return path.join(directory, `${baseName}.converted-${stamp}${outputExtension}`);
}

export async function convertVisioToModernPackage(
  extensionRoot: string,
  inputPath: string,
  outputPath: string,
  config: RadarConfig
): Promise<VisioConvertResult> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const scriptPath = path.join(extensionRoot, 'scripts', 'convert-visio-to-modern-package.ps1');
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
    outputPath
  ];

  try {
    const { stdout } = await execFile(config.pwshPath, args, {
      timeout: config.convertTimeoutMs,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    const parsed = parseConverterJson(stdout);
    return {
      ...parsed,
      command: `${config.pwshPath} ${args.join(' ')}`,
      durationMs: parsed.durationMs ?? Date.now() - startedAt
    };
  } catch (error) {
    const err = error as cp.ExecFileException & { stdout?: string; stderr?: string };
    const parsed = err.stdout ? tryParseConverterJson(err.stdout) : undefined;
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
      outputFormat: outputPathToFormat(outputPath),
      durationMs: Date.now() - startedAt,
      error: [err.message, err.stderr].filter(Boolean).join('\n'),
      errorType: err.killed ? 'Timeout' : 'ProcessError',
      command: `${config.pwshPath} ${args.join(' ')}`
    };
  }
}

function outputPathToFormat(outputPath: string): VisioConvertResult['outputFormat'] {
  const extension = path.extname(outputPath).toLowerCase();
  if (extension === '.vssx') {
    return 'vssx';
  }
  if (extension === '.vstx') {
    return 'vstx';
  }
  return 'vsdx';
}

function parseConverterJson(stdout: string): VisioConvertResult {
  const parsed = tryParseConverterJson(stdout);
  if (!parsed) {
    throw new Error(`Visio converter did not return JSON. Output: ${stdout}`);
  }
  return parsed;
}

function tryParseConverterJson(stdout: string): VisioConvertResult | undefined {
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
      return JSON.parse(lines[i]) as VisioConvertResult;
    } catch {
      // Keep looking for the final structured line.
    }
  }
  return undefined;
}
