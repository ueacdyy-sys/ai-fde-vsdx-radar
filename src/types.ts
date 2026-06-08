export type PreviewFormat = 'png' | 'pdf';
export type QaPreset = 'custom' | 'balanced' | 'strict' | 'quiet';

export interface RadarConfig {
  pwshPath: string;
  outputDirectory: string;
  previewFormat: PreviewFormat;
  qaPreset: QaPreset;
  autoExportOnSave: boolean;
  exportTimeoutMs: number;
  shapeDensityWarningThreshold: number;
  connectorRatioWarningThreshold: number;
  pageCoverageLowWarningThreshold: number;
  pageCoverageHighWarningThreshold: number;
  enableShapeDensityWarning: boolean;
  enableConnectorRatioWarning: boolean;
  enableUnlabeledShapeWarning: boolean;
  enablePageCoverageWarning: boolean;
  enableDiagonalConnectorWarning: boolean;
  enableConnectorCrossingWarning: boolean;
  enableDanglingConnectorWarning: boolean;
  enableShapeOverlapWarning: boolean;
}

export interface WorkspacePaths {
  workspaceRoot: string;
  outputRoot: string;
  previewDir: string;
  qaDir: string;
  cacheIndexPath: string;
}

export interface PreviewExportResult {
  success: boolean;
  inputPath: string;
  outputPath: string;
  outputPaths?: string[];
  format: PreviewFormat;
  pageCount?: number;
  durationMs?: number;
  bytes?: number;
  error?: string;
  errorType?: string;
  command?: string;
  cached?: boolean;
}

export interface CacheRecord {
  sourcePath: string;
  sourceMtimeMs: number;
  sourceSize: number;
  sourceHash?: string;
  previewPath: string;
  previewPaths?: string[];
  previewMtimeMs: number;
  previewSize: number;
  previewWidth?: number;
  previewHeight?: number;
  previewHasVisibleContent?: boolean;
  format: PreviewFormat;
  exportedPageCount?: number;
  qaPath?: string;
  updatedAt: string;
}

export interface CacheIndex {
  version: 1;
  records: Record<string, CacheRecord>;
}

export interface QaPageStat {
  name: string;
  entry: string;
  width?: number;
  height?: number;
  shapeCount: number;
  textShapeCount: number;
  unlabeledShapeCount: number;
  oneDShapeCount: number;
  connectCount: number;
  duplicateShapeIdCount: number;
  outOfBoundsShapeCount: number;
  diagonalConnectorCount: number;
  connectorCrossingCount: number;
  danglingConnectorCount: number;
  straightConnectorCount: number;
  orthogonalConnectorCount: number;
  complexConnectorCount: number;
  shapeOverlapPairCount: number;
  pageCoverageRatio?: number;
  riskCount: number;
}

export type QaSeverity = 'info' | 'warning' | 'error';

export interface QaRisk {
  severity: QaSeverity;
  code: string;
  message: string;
  page?: string;
}

export interface QaResult {
  schemaVersion: 1;
  sourcePath: string;
  sourceMtimeMs?: number;
  sourceModifiedAt?: string;
  generatedAt: string;
  previewPath?: string;
  previewPaths?: string[];
  previewExists: boolean;
  previewFresh: boolean;
  previewFreshnessReasons?: string[];
  stats: {
    pageCount: number;
    shapeCount: number;
    textShapeCount: number;
    unlabeledShapeCount: number;
    oneDShapeCount: number;
    connectCount: number;
    duplicateShapeIdCount: number;
    outOfBoundsShapeCount: number;
    diagonalConnectorCount: number;
    connectorCrossingCount: number;
    danglingConnectorCount: number;
    straightConnectorCount: number;
    orthogonalConnectorCount: number;
    complexConnectorCount: number;
    shapeOverlapPairCount: number;
    averagePageCoverageRatio?: number;
  };
  pages: QaPageStat[];
  risks: QaRisk[];
}
