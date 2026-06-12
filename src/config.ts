import * as vscode from 'vscode';
import { QaPreset, RadarConfig } from './types';

export function getRadarConfig(): RadarConfig {
  const cfg = vscode.workspace.getConfiguration('aiFdeVsdxRadar');
  const baseConfig: RadarConfig = {
    pwshPath: cfg.get<string>('pwshPath', 'pwsh'),
    outputDirectory: cfg.get<string>('outputDirectory', '.aifde'),
    previewFormat: cfg.get<'png' | 'pdf'>('previewFormat', 'png'),
    qaPreset: cfg.get<QaPreset>('qaPreset', 'custom'),
    autoExportOnSave: cfg.get<boolean>('autoExportOnSave', false),
    exportTimeoutMs: cfg.get<number>('exportTimeoutMs', 120000),
    convertTimeoutMs: cfg.get<number>('convertTimeoutMs', 300000),
    shapeDensityWarningThreshold: cfg.get<number>('shapeDensityWarningThreshold', 80),
    connectorRatioWarningThreshold: cfg.get<number>('connectorRatioWarningThreshold', 0.25),
    pageCoverageLowWarningThreshold: cfg.get<number>('pageCoverageLowWarningThreshold', 0.02),
    pageCoverageHighWarningThreshold: cfg.get<number>('pageCoverageHighWarningThreshold', 0.85),
    enableShapeDensityWarning: cfg.get<boolean>('enableShapeDensityWarning', true),
    enableConnectorRatioWarning: cfg.get<boolean>('enableConnectorRatioWarning', true),
    enableUnlabeledShapeWarning: cfg.get<boolean>('enableUnlabeledShapeWarning', true),
    enablePageCoverageWarning: cfg.get<boolean>('enablePageCoverageWarning', true),
    enableDiagonalConnectorWarning: cfg.get<boolean>('enableDiagonalConnectorWarning', true),
    enableConnectorCrossingWarning: cfg.get<boolean>('enableConnectorCrossingWarning', true),
    enableDanglingConnectorWarning: cfg.get<boolean>('enableDanglingConnectorWarning', true),
    enableShapeOverlapWarning: cfg.get<boolean>('enableShapeOverlapWarning', true)
  };
  return applyQaPreset(baseConfig);
}

function applyQaPreset(config: RadarConfig): RadarConfig {
  switch (config.qaPreset) {
    case 'balanced':
      return {
        ...config,
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
    case 'strict':
      return {
        ...config,
        shapeDensityWarningThreshold: 60,
        connectorRatioWarningThreshold: 0.35,
        pageCoverageLowWarningThreshold: 0.04,
        pageCoverageHighWarningThreshold: 0.75,
        enableShapeDensityWarning: true,
        enableConnectorRatioWarning: true,
        enableUnlabeledShapeWarning: true,
        enablePageCoverageWarning: true,
        enableDiagonalConnectorWarning: true,
        enableConnectorCrossingWarning: true,
        enableDanglingConnectorWarning: true,
        enableShapeOverlapWarning: true
      };
    case 'quiet':
      return {
        ...config,
        shapeDensityWarningThreshold: 120,
        connectorRatioWarningThreshold: 0.1,
        pageCoverageLowWarningThreshold: 0.005,
        pageCoverageHighWarningThreshold: 0.95,
        enableShapeDensityWarning: true,
        enableConnectorRatioWarning: true,
        enableUnlabeledShapeWarning: true,
        enablePageCoverageWarning: true,
        enableDiagonalConnectorWarning: false,
        enableConnectorCrossingWarning: true,
        enableDanglingConnectorWarning: true,
        enableShapeOverlapWarning: false
      };
    case 'custom':
    default:
      return config;
  }
}
