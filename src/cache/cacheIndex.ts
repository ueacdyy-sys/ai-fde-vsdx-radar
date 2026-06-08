import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import { inflateSync } from 'zlib';
import * as path from 'path';
import { CacheIndex, CacheRecord, PreviewFormat } from '../types';

const EMPTY_INDEX: CacheIndex = {
  version: 1,
  records: {}
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

interface PreviewFileInspection {
  filePath: string;
  valid: boolean;
  size: number;
  width?: number;
  height?: number;
  hasVisibleContent?: boolean;
  reason?: string;
}

export interface PreviewFreshnessDiagnosis {
  fresh: boolean;
  reasons: string[];
}

interface PngChunk {
  type: string;
  data: Buffer;
}

export async function loadCacheIndex(cacheIndexPath: string): Promise<CacheIndex> {
  if (!existsSync(cacheIndexPath)) {
    return { ...EMPTY_INDEX, records: {} };
  }

  try {
    const raw = await fs.readFile(cacheIndexPath, 'utf8');
    const parsed = JSON.parse(raw) as CacheIndex;
    if (parsed.version !== 1 || typeof parsed.records !== 'object') {
      return { ...EMPTY_INDEX, records: {} };
    }
    return parsed;
  } catch {
    return { ...EMPTY_INDEX, records: {} };
  }
}

export async function saveCacheIndex(cacheIndexPath: string, index: CacheIndex): Promise<void> {
  await fs.mkdir(path.dirname(cacheIndexPath), { recursive: true });
  await fs.writeFile(cacheIndexPath, JSON.stringify(index, null, 2), 'utf8');
}

export async function isPreviewFresh(
  index: CacheIndex,
  sourcePath: string,
  previewPath: string,
  format: PreviewFormat
): Promise<boolean> {
  return (await getPreviewFreshness(index, sourcePath, previewPath, format)).fresh;
}

export async function getPreviewFreshness(
  index: CacheIndex,
  sourcePath: string,
  previewPath: string,
  format: PreviewFormat
): Promise<PreviewFreshnessDiagnosis> {
  const record = index.records[sourcePath];
  if (!record) {
    return { fresh: false, reasons: ['cache record is missing'] };
  }

  const reasons: string[] = [];
  if (record.previewPath !== previewPath) {
    reasons.push(`cache record preview path mismatch: expected ${record.previewPath}, got ${previewPath}`);
  }
  if (record.format !== format) {
    reasons.push(`cache record format mismatch: expected ${record.format}, got ${format}`);
  }

  const previewPaths = record.previewPaths?.length ? record.previewPaths : [previewPath];
  const missingPreviewPaths = previewPaths.filter(candidate => !existsSync(candidate));
  if (!existsSync(previewPath) && !missingPreviewPaths.includes(previewPath)) {
    missingPreviewPaths.push(previewPath);
  }
  if (missingPreviewPaths.length > 0) {
    reasons.push(`preview file missing: ${missingPreviewPaths.join(', ')}`);
    return { fresh: false, reasons };
  }

  if (reasons.length > 0) {
    return { fresh: false, reasons };
  }

  try {
    const [sourceStat, previewStat, sourceHash, previewInspections] = await Promise.all([
      fs.stat(sourcePath),
      fs.stat(previewPath),
      hashFile(sourcePath),
      Promise.all(previewPaths.map(candidate => inspectPreviewFile(candidate, format)))
    ]);

    if (record.sourceMtimeMs !== sourceStat.mtimeMs) {
      reasons.push(`source mtime changed: cache=${record.sourceMtimeMs}, current=${sourceStat.mtimeMs}`);
    }
    if (record.sourceSize !== sourceStat.size) {
      reasons.push(`source size changed: cache=${record.sourceSize}, current=${sourceStat.size}`);
    }
    if (record.sourceHash !== sourceHash) {
      reasons.push(record.sourceHash
        ? 'source hash changed'
        : 'cache record source hash is missing');
    }
    if (record.previewMtimeMs !== previewStat.mtimeMs) {
      reasons.push(`preview mtime changed: cache=${record.previewMtimeMs}, current=${previewStat.mtimeMs}`);
    }
    if (record.previewSize !== previewStat.size) {
      reasons.push(`preview size changed: cache=${record.previewSize}, current=${previewStat.size}`);
    }

    for (const inspection of previewInspections) {
      if (!inspection.valid) {
        reasons.push(`preview file is invalid: ${inspection.filePath}${inspection.reason ? ` (${inspection.reason})` : ''}`);
      }
    }
  } catch (error) {
    reasons.push(`preview freshness inspection failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { fresh: reasons.length === 0, reasons };
}

export async function updatePreviewRecord(
  index: CacheIndex,
  sourcePath: string,
  previewPath: string,
  format: PreviewFormat,
  qaPath?: string,
  previewPaths?: string[],
  exportedPageCount?: number
): Promise<CacheRecord> {
  const previewPathList = normalizePreviewPaths(previewPath, previewPaths);
  const [sourceStat, previewStat, sourceHash, previewInspections] = await Promise.all([
    fs.stat(sourcePath),
    fs.stat(previewPath),
    hashFile(sourcePath),
    Promise.all(previewPathList.map(candidate => inspectPreviewFile(candidate, format)))
  ]);
  const invalidPreview = previewInspections.find(result => !result.valid);
  if (invalidPreview) {
    throw new Error(`Preview file is invalid: ${invalidPreview.filePath}${invalidPreview.reason ? ` (${invalidPreview.reason})` : ''}`);
  }
  const mainPreview = previewInspections.find(result => result.filePath === previewPath);

  const record: CacheRecord = {
    sourcePath,
    sourceMtimeMs: sourceStat.mtimeMs,
    sourceSize: sourceStat.size,
    sourceHash,
    previewPath,
    previewPaths: previewPathList,
    previewMtimeMs: previewStat.mtimeMs,
    previewSize: previewStat.size,
    previewWidth: mainPreview?.width,
    previewHeight: mainPreview?.height,
    previewHasVisibleContent: mainPreview?.hasVisibleContent,
    format,
    exportedPageCount,
    qaPath,
    updatedAt: new Date().toISOString()
  };

  index.records[sourcePath] = record;
  return record;
}

export async function hashFile(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
}

export async function inspectPreviewFile(filePath: string, format: PreviewFormat): Promise<PreviewFileInspection> {
  try {
    const buffer = await fs.readFile(filePath);
    if (buffer.length === 0) {
      return { filePath, valid: false, size: 0, reason: 'empty file' };
    }

    if (format === 'png') {
      return inspectPngPreview(filePath, buffer);
    }

    if (format === 'pdf') {
      return {
        filePath,
        valid: buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-',
        size: buffer.length,
        reason: buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-' ? undefined : 'missing PDF header'
      };
    }

    return { filePath, valid: buffer.length > 0, size: buffer.length };
  } catch (error) {
    return {
      filePath,
      valid: false,
      size: 0,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

function inspectPngPreview(filePath: string, buffer: Buffer): PreviewFileInspection {
  if (buffer.length < 33) {
    return { filePath, valid: false, size: buffer.length, reason: 'PNG file is too small' };
  }
  if (!PNG_SIGNATURE.equals(buffer.subarray(0, PNG_SIGNATURE.length))) {
    return { filePath, valid: false, size: buffer.length, reason: 'missing PNG signature' };
  }

  const ihdrLength = buffer.readUInt32BE(8);
  const chunkType = buffer.subarray(12, 16).toString('ascii');
  if (ihdrLength !== 13 || chunkType !== 'IHDR') {
    return { filePath, valid: false, size: buffer.length, reason: 'missing PNG IHDR chunk' };
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  const compressionMethod = buffer[26];
  const filterMethod = buffer[27];
  const interlaceMethod = buffer[28];
  if (width < 1 || height < 1) {
    return { filePath, valid: false, size: buffer.length, width, height, reason: 'invalid PNG dimensions' };
  }

  const chunkResult = readPngChunks(buffer);
  if (!chunkResult.valid) {
    return { filePath, valid: false, size: buffer.length, width, height, reason: chunkResult.reason };
  }
  const idatChunks = chunkResult.chunks.filter(chunk => chunk.type === 'IDAT').map(chunk => chunk.data);
  if (idatChunks.length === 0) {
    return { filePath, valid: false, size: buffer.length, width, height, reason: 'missing PNG IDAT chunk' };
  }
  if (!chunkResult.chunks.some(chunk => chunk.type === 'IEND')) {
    return { filePath, valid: false, size: buffer.length, width, height, reason: 'missing PNG IEND chunk' };
  }

  const pixelInspection = inspectPngPixels(idatChunks, width, height, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod);
  if (pixelInspection.supported && (!pixelInspection.valid || !pixelInspection.hasVisibleContent)) {
    return {
      filePath,
      valid: false,
      size: buffer.length,
      width,
      height,
      hasVisibleContent: pixelInspection.hasVisibleContent,
      reason: pixelInspection.reason ?? 'blank PNG image data'
    };
  }

  return {
    filePath,
    valid: true,
    size: buffer.length,
    width,
    height,
    hasVisibleContent: pixelInspection.supported ? pixelInspection.hasVisibleContent : undefined
  };
}

function normalizePreviewPaths(previewPath: string, previewPaths?: string[]): string[] {
  const candidates = previewPaths?.length ? previewPaths : [previewPath];
  return Array.from(new Set([previewPath, ...candidates]));
}

function readPngChunks(buffer: Buffer): { valid: true; chunks: PngChunk[] } | { valid: false; reason: string; chunks: PngChunk[] } {
  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const nextOffset = dataEnd + 4;
    if (dataEnd > buffer.length || nextOffset > buffer.length) {
      return { valid: false, reason: `truncated PNG ${type || 'chunk'}`, chunks };
    }
    chunks.push({ type, data: buffer.subarray(dataStart, dataEnd) });
    offset = nextOffset;
    if (type === 'IEND') {
      return { valid: true, chunks };
    }
  }
  return { valid: false, reason: 'missing PNG IEND chunk', chunks };
}

function inspectPngPixels(
  idatChunks: Buffer[],
  width: number,
  height: number,
  bitDepth: number,
  colorType: number,
  compressionMethod: number,
  filterMethod: number,
  interlaceMethod: number
): { supported: false } | { supported: true; valid: boolean; hasVisibleContent: boolean; reason?: string } {
  const channels = getPngChannelCount(colorType);
  if (bitDepth !== 8 || channels === undefined || compressionMethod !== 0 || filterMethod !== 0 || interlaceMethod !== 0) {
    return { supported: false };
  }

  const bytesPerPixel = channels;
  const scanlineLength = width * channels;
  const expectedLength = (scanlineLength + 1) * height;
  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.concat(idatChunks));
  } catch (error) {
    return {
      supported: true,
      valid: false,
      hasVisibleContent: false,
      reason: error instanceof Error ? `PNG IDAT inflate failed: ${error.message}` : 'PNG IDAT inflate failed'
    };
  }
  if (inflated.length < expectedLength) {
    return { supported: true, valid: false, hasVisibleContent: false, reason: 'PNG pixel data is incomplete' };
  }

  const pixels = unfilterPngScanlines(inflated, width, height, channels, bytesPerPixel);
  if (!pixels) {
    return { supported: true, valid: false, hasVisibleContent: false, reason: 'unsupported PNG filter type' };
  }

  return { supported: true, valid: true, hasVisibleContent: pngHasVisibleContent(pixels, width, height, colorType, channels) };
}

function getPngChannelCount(colorType: number): number | undefined {
  switch (colorType) {
    case 0:
      return 1;
    case 2:
      return 3;
    case 4:
      return 2;
    case 6:
      return 4;
    default:
      return undefined;
  }
}

function unfilterPngScanlines(inflated: Buffer, width: number, height: number, channels: number, bytesPerPixel: number): Buffer | undefined {
  const scanlineLength = width * channels;
  const output = Buffer.alloc(scanlineLength * height);
  let inputOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filterType = inflated[inputOffset];
    inputOffset += 1;
    const rowOffset = row * scanlineLength;
    const previousRowOffset = rowOffset - scanlineLength;
    for (let col = 0; col < scanlineLength; col += 1) {
      const raw = inflated[inputOffset + col];
      const left = col >= bytesPerPixel ? output[rowOffset + col - bytesPerPixel] : 0;
      const up = row > 0 ? output[previousRowOffset + col] : 0;
      const upLeft = row > 0 && col >= bytesPerPixel ? output[previousRowOffset + col - bytesPerPixel] : 0;
      const value = unfilterPngByte(filterType, raw, left, up, upLeft);
      if (value === undefined) {
        return undefined;
      }
      output[rowOffset + col] = value;
    }
    inputOffset += scanlineLength;
  }
  return output;
}

function unfilterPngByte(filterType: number, raw: number, left: number, up: number, upLeft: number): number | undefined {
  switch (filterType) {
    case 0:
      return raw;
    case 1:
      return (raw + left) & 0xff;
    case 2:
      return (raw + up) & 0xff;
    case 3:
      return (raw + Math.floor((left + up) / 2)) & 0xff;
    case 4:
      return (raw + paethPredictor(left, up, upLeft)) & 0xff;
    default:
      return undefined;
  }
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) {
    return left;
  }
  return pb <= pc ? up : upLeft;
}

function pngHasVisibleContent(pixels: Buffer, width: number, height: number, colorType: number, channels: number): boolean {
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * channels;
    if (isVisibleNonWhitePixel(pixels, offset, colorType)) {
      return true;
    }
  }
  return false;
}

function isVisibleNonWhitePixel(pixels: Buffer, offset: number, colorType: number): boolean {
  const whiteThreshold = 250;
  if (colorType === 0) {
    return pixels[offset] < whiteThreshold;
  }
  if (colorType === 2) {
    return pixels[offset] < whiteThreshold || pixels[offset + 1] < whiteThreshold || pixels[offset + 2] < whiteThreshold;
  }
  if (colorType === 4) {
    return pixels[offset + 1] > 0 && pixels[offset] < whiteThreshold;
  }
  if (colorType === 6) {
    return pixels[offset + 3] > 0
      && (pixels[offset] < whiteThreshold || pixels[offset + 1] < whiteThreshold || pixels[offset + 2] < whiteThreshold);
  }
  return true;
}
