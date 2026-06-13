import * as path from 'path';

export const modernVisioExtensions = ['.vsdx', '.vsdm', '.vssx', '.vssm', '.vstx', '.vstm'] as const;
export const legacyXmlVisioExtensions = ['.vdx', '.vsx', '.vtx'] as const;
export const legacyBinaryVisioExtensions = ['.vsd', '.vss', '.vst'] as const;
export const legacyOpaqueVisioExtensions = ['.vdw', '.vwi', '.vsw'] as const;
export const legacyVisioExtensions = [...legacyXmlVisioExtensions, ...legacyBinaryVisioExtensions, ...legacyOpaqueVisioExtensions] as const;
export const semanticVisioExtensions = [...modernVisioExtensions, ...legacyXmlVisioExtensions] as const;
export const allVisioExtensions = [...semanticVisioExtensions, ...legacyBinaryVisioExtensions, ...legacyOpaqueVisioExtensions] as const;
export const modernVisioFileGlob = '**/*.{vsdx,vsdm,vssx,vssm,vstx,vstm}';
export const legacyXmlVisioFileGlob = '**/*.{vdx,vsx,vtx}';
export const semanticVisioFileGlob = '**/*.{vsdx,vsdm,vssx,vssm,vstx,vstm,vdx,vsx,vtx}';
export const allVisioFileGlob = '**/*.{vsdx,vsdm,vssx,vssm,vstx,vstm,vdx,vsx,vtx,vsd,vss,vst,vdw,vwi,vsw}';
export const modernVisioOpenDialogExtensions = modernVisioExtensions.map(extension => extension.slice(1));
export const semanticVisioOpenDialogExtensions = semanticVisioExtensions.map(extension => extension.slice(1));
export const allVisioOpenDialogExtensions = allVisioExtensions.map(extension => extension.slice(1));

export type VisioFormatSupport = 'modern-package' | 'legacy-xml' | 'legacy-binary' | 'legacy-opaque' | 'unknown';

export function isVisioLockFilePath(filePath: string): boolean {
  return path.basename(filePath).startsWith('~$$');
}

export function isModernVisioPath(filePath: string): boolean {
  if (isVisioLockFilePath(filePath)) {
    return false;
  }
  return modernVisioExtensions.includes(path.extname(filePath).toLowerCase() as typeof modernVisioExtensions[number]);
}

export function isLegacyXmlVisioPath(filePath: string): boolean {
  if (isVisioLockFilePath(filePath)) {
    return false;
  }
  return legacyXmlVisioExtensions.includes(path.extname(filePath).toLowerCase() as typeof legacyXmlVisioExtensions[number]);
}

export function isLegacyBinaryVisioPath(filePath: string): boolean {
  if (isVisioLockFilePath(filePath)) {
    return false;
  }
  return legacyBinaryVisioExtensions.includes(path.extname(filePath).toLowerCase() as typeof legacyBinaryVisioExtensions[number]);
}

export function isLegacyOpaqueVisioPath(filePath: string): boolean {
  if (isVisioLockFilePath(filePath)) {
    return false;
  }
  return legacyOpaqueVisioExtensions.includes(path.extname(filePath).toLowerCase() as typeof legacyOpaqueVisioExtensions[number]);
}

export function isLegacyVisioPath(filePath: string): boolean {
  if (isVisioLockFilePath(filePath)) {
    return false;
  }
  return legacyVisioExtensions.includes(path.extname(filePath).toLowerCase() as typeof legacyVisioExtensions[number]);
}

export function isSemanticVisioPath(filePath: string): boolean {
  if (isVisioLockFilePath(filePath)) {
    return false;
  }
  const extension = path.extname(filePath).toLowerCase();
  return semanticVisioExtensions.includes(extension as typeof semanticVisioExtensions[number]);
}

export function isVisioPath(filePath: string): boolean {
  if (isVisioLockFilePath(filePath)) {
    return false;
  }
  const extension = path.extname(filePath).toLowerCase();
  return allVisioExtensions.includes(extension as typeof allVisioExtensions[number]);
}

export function getVisioFormatSupport(filePath: string): VisioFormatSupport {
  if (isModernVisioPath(filePath)) {
    return 'modern-package';
  }
  if (isLegacyXmlVisioPath(filePath)) {
    return 'legacy-xml';
  }
  if (isLegacyBinaryVisioPath(filePath)) {
    return 'legacy-binary';
  }
  if (isLegacyOpaqueVisioPath(filePath)) {
    return 'legacy-opaque';
  }
  return 'unknown';
}
