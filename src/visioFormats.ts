import * as path from 'path';

export const modernVisioExtensions = ['.vsdx', '.vsdm', '.vssx', '.vssm', '.vstx', '.vstm'] as const;
export const legacyVisioExtensions = ['.vsd', '.vss', '.vst'] as const;
export const allVisioExtensions = [...modernVisioExtensions, ...legacyVisioExtensions] as const;
export const modernVisioFileGlob = '**/*.{vsdx,vsdm,vssx,vssm,vstx,vstm}';
export const allVisioFileGlob = '**/*.{vsdx,vsdm,vssx,vssm,vstx,vstm,vsd,vss,vst}';
export const modernVisioOpenDialogExtensions = modernVisioExtensions.map(extension => extension.slice(1));
export const allVisioOpenDialogExtensions = allVisioExtensions.map(extension => extension.slice(1));

export type VisioFormatSupport = 'modern-package' | 'legacy-binary' | 'unknown';

export function isModernVisioPath(filePath: string): boolean {
  return modernVisioExtensions.includes(path.extname(filePath).toLowerCase() as typeof modernVisioExtensions[number]);
}

export function isLegacyVisioPath(filePath: string): boolean {
  return legacyVisioExtensions.includes(path.extname(filePath).toLowerCase() as typeof legacyVisioExtensions[number]);
}

export function isVisioPath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return allVisioExtensions.includes(extension as typeof allVisioExtensions[number]);
}

export function getVisioFormatSupport(filePath: string): VisioFormatSupport {
  if (isModernVisioPath(filePath)) {
    return 'modern-package';
  }
  if (isLegacyVisioPath(filePath)) {
    return 'legacy-binary';
  }
  return 'unknown';
}
