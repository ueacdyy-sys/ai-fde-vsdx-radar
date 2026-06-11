import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getRadarConfig } from './config';
import { getPreviewFreshness, isPreviewFresh, loadCacheIndex, saveCacheIndex, updatePreviewRecord } from './cache/cacheIndex';
import { exportVisioPreview } from './exporter/visioExporter';
import { analyzeVsdx } from './qa/vsdxParser';
import { toQaSummaryMarkdown } from './qa/reporter';
import {
  isVsdxPath,
  resolvePreviewPath,
  resolveQaPath,
  resolveQaSummaryPath,
  resolveWorkspacePaths
} from './paths';
import {
  formatPreviewFreshnessSummaryFiles,
  summarizePreviewFreshnessReasonsForItems,
  toPreviewFreshnessReasonKeys,
  type PreviewFreshnessSummaryItem
} from './previewFreshnessSummary';
import { PreviewExportResult, QaResult, RadarConfig } from './types';
import { interactiveEditorViewType, VsdxInteractiveEditorProvider } from './editor/vsdxInteractiveEditor';

let output: vscode.OutputChannel;
const pendingAutoRuns = new Map<string, NodeJS.Timeout>();

type WorkspaceReviewStatus = 'new' | 'reviewing' | 'accepted' | 'resolved';

const defaultReviewStatus: WorkspaceReviewStatus = 'new';
const reviewStatusOptions: Array<{ value: WorkspaceReviewStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'resolved', label: 'Resolved' }
];

interface VsdxStatus {
  badge: string;
  color: string;
  tooltip: string;
  previewPath: string;
  qaPath: string;
  summaryPath: string;
  errors: number;
  warnings: number;
  previewFreshnessReasons: string[];
}

interface WorkspaceReportItem {
  sourcePath: string;
  relativePath: string;
  badge: string;
  statusRank: number;
  errors: number;
  warnings: number;
  riskCodes: string[];
  previewPath: string;
  qaPath: string;
  summaryPath: string;
  reviewStatus: WorkspaceReviewStatus;
  reviewOwner: string;
  reviewDueDate: string;
  reviewNote: string;
  reviewUpdatedAt?: string;
  tooltip: string;
  previewFreshnessReasons: string[];
}

interface WorkspaceOwnerSummaryItem {
  owner: string;
  total: number;
  risks: number;
  overdue: number;
  dueSoon: number;
  reviewStatusCounts: Record<WorkspaceReviewStatus, number>;
}

interface WorkspaceReportResult {
  jsonPath: string;
  markdownPath: string;
  generatedAt: string;
  total: number;
  counts: Record<string, number>;
  ownerSummary: WorkspaceOwnerSummaryItem[];
  previewFreshnessSummary: PreviewFreshnessSummaryItem[];
}

interface WorkspaceDueCalendarResult {
  icsPath: string;
  generatedAt: string;
  total: number;
}

interface WorkspaceTeamBoardOwnerItem {
  owner: string;
  total: number;
  counts: Record<string, number>;
  overdue: number;
  dueSoon: number;
  nextDueDate: string;
}

interface WorkspaceTeamBoardLane {
  status: WorkspaceReviewStatus;
  label: string;
  total: number;
  counts: Record<string, number>;
  overdue: number;
  dueSoon: number;
  owners: WorkspaceTeamBoardOwnerItem[];
  items: WorkspaceReportItem[];
}

interface WorkspaceTeamBoardResult {
  jsonPath: string;
  markdownPath: string;
  generatedAt: string;
  total: number;
  lanes: WorkspaceTeamBoardLane[];
  previewFreshnessSummary: PreviewFreshnessSummaryItem[];
}

interface DemoPackArtifact {
  kind: string;
  label: string;
  path: string;
  bytes: number;
  modifiedAt: string;
}

interface DemoPackResult {
  jsonPath: string;
  markdownPath: string;
  generatedAt: string;
  totalArtifacts: number;
}

interface WorkspaceReportCollection {
  workspaceRoot: string;
  reportRoot: string;
  notesPath: string;
  items: WorkspaceReportItem[];
  counts: Record<string, number>;
}

interface WorkspaceRiskNote {
  status: WorkspaceReviewStatus;
  owner: string;
  dueDate: string;
  note: string;
  updatedAt: string;
}

interface WorkspaceRiskNoteUpdate {
  sourcePath: string;
  status?: WorkspaceReviewStatus;
  owner?: string;
  dueDate?: string;
  note?: string;
}

interface QaConfigTemplateProfile {
  name: string;
  namespace: string;
  description: string;
  settings: Record<string, string | number | boolean>;
}

interface QaProfileStrategy {
  name: string;
  namespace: string;
  description: string;
  useWhen: string;
  rationale: string;
  profiles: string[];
}

interface QaProfileAuditEntry {
  appliedAt: string;
  workspaceRoot: string;
  profileName: string;
  profileDescription: string;
  settings: Record<string, string | number | boolean>;
  previousEffectiveConfig: Record<string, string | number | boolean>;
}

interface QaProfileAuditPayload {
  updatedAt: string;
  workspaceRoot: string;
  entries: QaProfileAuditEntry[];
  readError?: string;
}

interface QaProfileAuditReportResult {
  jsonPath: string;
  markdownPath: string;
  generatedAt: string;
  total: number;
}

interface QaProfileStrategyTemplateResult {
  jsonPath: string;
  markdownPath: string;
  generatedAt: string;
  total: number;
}

interface QaConfigExportResult {
  jsonPath: string;
  markdownPath: string;
  generatedAt: string;
  total: number;
}

interface QaConfigImportResult {
  sourcePath: string;
  sourceCandidate: string;
  appliedCount: number;
  ignoredKeys: string[];
  auditPath: string;
}

interface QaConfigRollbackResult {
  profileName: string;
  appliedAt: string;
  appliedCount: number;
  ignoredKeys: string[];
  auditPath: string;
}

interface QaConfigProfileStackResult {
  profileNames: string[];
  appliedCount: number;
  auditPath: string;
}

interface QaProfileStrategyApplyResult {
  strategy: QaProfileStrategy;
  profileNames: string[];
  appliedCount: number;
  auditPath: string;
}

type QaConfigDiffStatus = 'same' | 'changed' | 'missing-in-source';

interface QaConfigDiffRow {
  setting: string;
  currentValue: string | number | boolean;
  sourceValue?: string | number | boolean;
  status: QaConfigDiffStatus;
}

interface QaConfigDiffResult {
  sourcePath: string;
  sourceCandidate: string;
  jsonPath: string;
  markdownPath: string;
  generatedAt: string;
  same: number;
  changed: number;
  missing: number;
  ignoredKeys: string[];
}

interface QaConfigImportCandidate {
  name: string;
  description: string;
  settings: Record<string, unknown>;
}

const radarConfigKeys: Array<keyof RadarConfig> = [
  'pwshPath',
  'outputDirectory',
  'previewFormat',
  'qaPreset',
  'autoExportOnSave',
  'exportTimeoutMs',
  'shapeDensityWarningThreshold',
  'connectorRatioWarningThreshold',
  'pageCoverageLowWarningThreshold',
  'pageCoverageHighWarningThreshold',
  'enableShapeDensityWarning',
  'enableConnectorRatioWarning',
  'enableUnlabeledShapeWarning',
  'enablePageCoverageWarning',
  'enableDiagonalConnectorWarning',
  'enableConnectorCrossingWarning',
  'enableDanglingConnectorWarning',
  'enableShapeOverlapWarning'
];

const radarConfigKeySet = new Set<string>(radarConfigKeys);

class VsdxDecorationProvider implements vscode.FileDecorationProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this.emitter.event;

  refresh(uri?: vscode.Uri): void {
    this.emitter.fire(uri);
  }

  async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
    if (!isVsdxPath(uri.fsPath)) {
      return undefined;
    }

    const status = await getVsdxStatus(uri.fsPath);
    return new vscode.FileDecoration(
      status.badge,
      status.tooltip,
      new vscode.ThemeColor(status.color)
    );
  }
}

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('AI-FDE VSDX Radar');
  context.subscriptions.push(output);
  const decorations = new VsdxDecorationProvider();
  context.subscriptions.push(vscode.window.registerFileDecorationProvider(decorations));
  context.subscriptions.push(VsdxInteractiveEditorProvider.register(context, output, getVsdxStatus));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.openInteractiveEditor', async (uri?: vscode.Uri) => {
    await runSafely(async () => {
      const filePath = await resolveTargetPath(uri);
      if (!filePath) {
        return;
      }
      await vscode.commands.executeCommand(
        'vscode.openWith',
        vscode.Uri.file(filePath),
        interactiveEditorViewType
      );
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.exportPreview', async (uri?: vscode.Uri) => {
    await runSafely(async () => {
      const filePath = await resolveTargetPath(uri);
      if (!filePath) {
        return;
      }
      const result = await withProgress('Exporting VSDX preview', () => exportPreviewForFile(context.extensionPath, filePath));
      reportExport(result);
      decorations.refresh(vscode.Uri.file(filePath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.runQa', async (uri?: vscode.Uri) => {
    await runSafely(async () => {
      const filePath = await resolveTargetPath(uri);
      if (!filePath) {
        return;
      }
      const result = await withProgress('Running VSDX QA', () => runQaForFile(filePath));
      reportQa(result);
      decorations.refresh(vscode.Uri.file(filePath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.exportAndQa', async (uri?: vscode.Uri) => {
    await runSafely(async () => {
      const filePath = await resolveTargetPath(uri);
      if (!filePath) {
        return;
      }
      const exportResult = await withProgress('Exporting VSDX preview and QA', () => exportPreviewForFile(context.extensionPath, filePath));
      reportExport(exportResult);
      const qaResult = await withProgress('Running VSDX QA', () => runQaForFile(filePath, exportResult.outputPath));
      reportQa(qaResult);
      decorations.refresh(vscode.Uri.file(filePath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.openPreview', async (uri?: vscode.Uri) => {
    await runSafely(async () => {
      const filePath = await resolveTargetPath(uri);
      if (!filePath) {
        return;
      }
      const result = await withProgress('Opening VSDX preview', () => exportPreviewForFile(context.extensionPath, filePath));
      reportExport(result);
      decorations.refresh(vscode.Uri.file(filePath));
      if (!result.success) {
        throw new Error(result.error ?? 'Preview export failed.');
      }
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.outputPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.openAllPreviews', async (uri?: vscode.Uri) => {
    await runSafely(async () => {
      const filePath = await resolveTargetPath(uri);
      if (!filePath) {
        return;
      }
      const result = await withProgress('Opening all VSDX previews', () => exportPreviewForFile(context.extensionPath, filePath));
      reportExport(result);
      decorations.refresh(vscode.Uri.file(filePath));
      if (!result.success) {
        throw new Error(result.error ?? 'Preview export failed.');
      }

      const previewPaths = resolvePreviewOpenPaths(result);
      for (const previewPath of previewPaths) {
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(previewPath), { preview: false });
      }
      output.appendLine(`[preview:opened] ${previewPaths.length} preview file(s) opened.`);
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.openQaReport', async (uri?: vscode.Uri) => {
    await runSafely(async () => {
      const filePath = await resolveTargetPath(uri);
      if (!filePath) {
        return;
      }
      const result = await withProgress('Opening VSDX QA report', () => runQaForFile(filePath));
      reportQa(result);
      decorations.refresh(vscode.Uri.file(filePath));
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.summaryPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.showStatus', async (uri?: vscode.Uri) => {
    await runSafely(async () => {
      const filePath = await resolveTargetPath(uri);
      if (!filePath) {
        return;
      }
      const status = await getVsdxStatus(filePath);
      output.appendLine(`[status] ${path.basename(filePath)} badge=${status.badge} errors=${status.errors} warnings=${status.warnings}`);
      output.appendLine(`  preview=${status.previewPath}`);
      output.appendLine(`  qa=${status.qaPath}`);
      if (status.previewFreshnessReasons.length > 0) {
        output.appendLine(`  previewFreshness=${summarizePreviewFreshnessReasons(status.previewFreshnessReasons)}`);
      }
      await vscode.window.showInformationMessage(status.tooltip);
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.revealArtifacts', async (uri?: vscode.Uri) => {
    await runSafely(async () => {
      const filePath = await resolveTargetPath(uri);
      if (!filePath) {
        return;
      }
      await revealArtifactsForFile(filePath);
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.generateWorkspaceReport', async () => {
    await runSafely(async () => {
      const result = await withProgress('Generating workspace VSDX report', () => generateWorkspaceReport());
      output.appendLine(`[workspace-report] files=${result.total}`);
      output.appendLine(`  json=${result.jsonPath}`);
      output.appendLine(`  summary=${result.markdownPath}`);
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.markdownPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.generateWorkspaceRiskReport', async () => {
    await runSafely(async () => {
      const result = await withProgress('Generating workspace VSDX risk report', () => generateWorkspaceRiskReport());
      output.appendLine(`[workspace-risk-report] files=${result.total}`);
      output.appendLine(`  json=${result.jsonPath}`);
      output.appendLine(`  summary=${result.markdownPath}`);
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.markdownPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.generateWorkspaceDueRiskReport', async () => {
    await runSafely(async () => {
      const result = await withProgress('Generating workspace due VSDX risk report', () => generateWorkspaceDueRiskReport());
      output.appendLine(`[workspace-due-risk-report] files=${result.total}`);
      output.appendLine(`  json=${result.jsonPath}`);
      output.appendLine(`  summary=${result.markdownPath}`);
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.markdownPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.exportWorkspaceDueRiskCalendar', async () => {
    await runSafely(async () => {
      const result = await withProgress('Exporting workspace due VSDX risk calendar', () => exportWorkspaceDueRiskCalendar());
      output.appendLine(`[workspace-due-risk-calendar] events=${result.total}`);
      output.appendLine(`  ics=${result.icsPath}`);
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.icsPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.showWorkspaceDueRiskReminder', async () => {
    await runSafely(async () => {
      const collection = await withProgress('Checking workspace due VSDX risks', () => collectWorkspaceReportItems());
      await showWorkspaceDueRiskReminder(collection);
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.generateWorkspaceTeamBoard', async () => {
    await runSafely(async () => {
      const result = await withProgress('Generating workspace VSDX team review board', () => generateWorkspaceTeamBoard());
      output.appendLine(`[workspace-team-board] files=${result.total} lanes=${result.lanes.length}`);
      output.appendLine(`  json=${result.jsonPath}`);
      output.appendLine(`  summary=${result.markdownPath}`);
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.markdownPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.generateDemoPack', async () => {
    await runSafely(async () => {
      const result = await withProgress('Generating AI-FDE VSDX demo pack', () => generateDemoPack());
      output.appendLine(`[demo-pack] artifacts=${result.totalArtifacts}`);
      output.appendLine(`  json=${result.jsonPath}`);
      output.appendLine(`  summary=${result.markdownPath}`);
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.markdownPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.generateQaConfigTemplate', async () => {
    await runSafely(async () => {
      const result = await withProgress('Generating QA config template', () => generateQaConfigTemplate());
      output.appendLine('[qa-config-template]');
      output.appendLine(`  json=${result.jsonPath}`);
      output.appendLine(`  summary=${result.markdownPath}`);
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.markdownPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.generateQaProfileStrategyTemplate', async () => {
    await runSafely(async () => {
      const result = await withProgress('Generating QA profile strategy template', () => generateQaProfileStrategyTemplate());
      output.appendLine(`[qa-profile-strategy-template] strategies=${result.total}`);
      output.appendLine(`  json=${result.jsonPath}`);
      output.appendLine(`  summary=${result.markdownPath}`);
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.markdownPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.exportQaConfig', async () => {
    await runSafely(async () => {
      const result = await withProgress('Exporting QA config', () => exportQaConfig());
      output.appendLine(`[qa-config-export] settings=${result.total}`);
      output.appendLine(`  json=${result.jsonPath}`);
      output.appendLine(`  summary=${result.markdownPath}`);
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.markdownPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.importQaConfig', async () => {
    await runSafely(async () => {
      const result = await importQaConfig();
      if (!result) {
        return;
      }
      output.appendLine(`[qa-config-import] applied=${result.appliedCount} ignored=${result.ignoredKeys.length}`);
      output.appendLine(`  source=${result.sourcePath}`);
      output.appendLine(`  candidate=${result.sourceCandidate}`);
      output.appendLine(`  audit=${result.auditPath}`);
      if (result.ignoredKeys.length > 0) {
        output.appendLine(`  ignored=${result.ignoredKeys.join(', ')}`);
      }
      await vscode.window.showInformationMessage(`AI-FDE VSDX Radar: imported ${result.appliedCount} QA config setting(s).`);
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.generateQaConfigDiffReport', async () => {
    await runSafely(async () => {
      const result = await generateQaConfigDiffReport();
      if (!result) {
        return;
      }
      output.appendLine(`[qa-config-diff] changed=${result.changed} missing=${result.missing} same=${result.same} ignored=${result.ignoredKeys.length}`);
      output.appendLine(`  source=${result.sourcePath}`);
      output.appendLine(`  candidate=${result.sourceCandidate}`);
      output.appendLine(`  json=${result.jsonPath}`);
      output.appendLine(`  summary=${result.markdownPath}`);
      if (result.ignoredKeys.length > 0) {
        output.appendLine(`  ignored=${result.ignoredKeys.join(', ')}`);
      }
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.markdownPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.rollbackQaConfig', async () => {
    await runSafely(async () => {
      const result = await rollbackQaConfig();
      if (!result) {
        return;
      }
      output.appendLine(`[qa-config-rollback] restored=${result.appliedCount} from=${result.profileName} appliedAt=${result.appliedAt}`);
      output.appendLine(`  audit=${result.auditPath}`);
      if (result.ignoredKeys.length > 0) {
        output.appendLine(`  ignored=${result.ignoredKeys.join(', ')}`);
      }
      await vscode.window.showInformationMessage(`AI-FDE VSDX Radar: rolled back ${result.appliedCount} QA config setting(s).`);
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.applyQaConfigProfile', async () => {
    await runSafely(async () => {
      const result = await applyQaConfigProfile();
      if (!result) {
        return;
      }
      output.appendLine(`[qa-config-profile] applied=${result.profile.name}`);
      output.appendLine(`  audit=${result.auditPath}`);
      await vscode.window.showInformationMessage(`AI-FDE VSDX Radar: applied QA profile "${result.profile.name}" to workspace settings.`);
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.applyQaConfigProfileStack', async () => {
    await runSafely(async () => {
      const result = await applyQaConfigProfileStack();
      if (!result) {
        return;
      }
      output.appendLine(`[qa-config-profile-stack] applied=${result.profileNames.join(' + ')} settings=${result.appliedCount}`);
      output.appendLine(`  audit=${result.auditPath}`);
      await vscode.window.showInformationMessage(`AI-FDE VSDX Radar: applied ${result.profileNames.length} QA profile(s) to workspace settings.`);
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.applyQaProfileStrategy', async () => {
    await runSafely(async () => {
      const result = await applyQaProfileStrategy();
      if (!result) {
        return;
      }
      output.appendLine(`[qa-profile-strategy] applied=${toQaProfileStrategyDisplayName(result.strategy)} profiles=${result.profileNames.join(' -> ')} settings=${result.appliedCount}`);
      output.appendLine(`  audit=${result.auditPath}`);
      await vscode.window.showInformationMessage(`AI-FDE VSDX Radar: applied QA profile strategy "${toQaProfileStrategyDisplayName(result.strategy)}".`);
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.openQaProfileAuditReport', async () => {
    await runSafely(async () => {
      const result = await withProgress('Opening QA profile audit report', () => generateQaProfileAuditReport());
      output.appendLine(`[qa-profile-audit] entries=${result.total}`);
      output.appendLine(`  json=${result.jsonPath}`);
      output.appendLine(`  summary=${result.markdownPath}`);
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.markdownPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.openWorkspaceRiskDashboard', async () => {
    await runSafely(async () => {
      const collection = await withProgress('Opening workspace VSDX risk dashboard', () => collectWorkspaceReportItems());
      const riskItems = collection.items.filter(item => item.badge !== 'OK');
      const report = await writeWorkspaceReport(
        collection,
        riskItems,
        'workspace-vsdx-risk-report',
        'AI-FDE Workspace VSDX Risk Report',
        'Non-OK workspace VSDX files'
      );
      output.appendLine(`[workspace-risk-dashboard] files=${collection.items.length} risks=${riskItems.length}`);
      output.appendLine(`  json=${report.jsonPath}`);
      output.appendLine(`  summary=${report.markdownPath}`);
      openWorkspaceRiskDashboard(context, collection, report);
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.openHighestPriorityRisk', async () => {
    await runSafely(async () => {
      const collection = await withProgress('Opening highest priority VSDX risk', () => collectWorkspaceReportItems());
      const risk = collection.items.find(item => item.badge !== 'OK');
      if (!risk) {
        output.appendLine('[workspace-risk] no non-OK VSDX files found.');
        await vscode.window.showInformationMessage('AI-FDE VSDX Radar: no non-OK VSDX files found.');
        return;
      }

      const targetPath = resolveRiskOpenPath(risk);
      output.appendLine(`[workspace-risk] ${risk.badge} ${risk.relativePath}`);
      output.appendLine(`  target=${targetPath}`);
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(targetPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.openNextDueRisk', async () => {
    await runSafely(async () => {
      const collection = await withProgress('Opening next due VSDX risk', () => collectWorkspaceReportItems());
      const risk = sortRisksByDuePriority(collection.items.filter(item => item.badge !== 'OK'))[0];
      if (!risk) {
        output.appendLine('[workspace-risk:due] no non-OK VSDX files found.');
        await vscode.window.showInformationMessage('AI-FDE VSDX Radar: no non-OK VSDX files found.');
        return;
      }

      const targetPath = resolveRiskOpenPath(risk);
      output.appendLine(`[workspace-risk:due] ${risk.badge} ${risk.relativePath} due=${risk.reviewDueDate || 'none'}`);
      output.appendLine(`  target=${targetPath}`);
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(targetPath));
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiFdeVsdxRadar.openAllRiskReports', async () => {
    await runSafely(async () => {
      const collection = await withProgress('Opening all VSDX risk reports', () => collectWorkspaceReportItems());
      const risks = collection.items.filter(item => item.badge !== 'OK');
      if (risks.length === 0) {
        output.appendLine('[workspace-risk] no non-OK VSDX files found.');
        await vscode.window.showInformationMessage('AI-FDE VSDX Radar: no non-OK VSDX files found.');
        return;
      }

      for (const risk of risks) {
        const targetPath = resolveRiskOpenPath(risk);
        output.appendLine(`[workspace-risk:open] ${risk.badge} ${risk.relativePath} -> ${targetPath}`);
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(targetPath), { preview: false });
      }
      await vscode.window.showInformationMessage(`AI-FDE VSDX Radar: opened ${risks.length} risk report(s).`);
    });
  }));

  const watcher = vscode.workspace.createFileSystemWatcher('**/*.vsdx');
  context.subscriptions.push(watcher);
  watcher.onDidChange(uri => {
    decorations.refresh(uri);
    scheduleAutoExport(context.extensionPath, uri, decorations);
  }, null, context.subscriptions);
  watcher.onDidCreate(uri => {
    decorations.refresh(uri);
    scheduleAutoExport(context.extensionPath, uri, decorations);
  }, null, context.subscriptions);
}

export function deactivate(): void {
  for (const timer of pendingAutoRuns.values()) {
    clearTimeout(timer);
  }
  pendingAutoRuns.clear();
}

async function resolveTargetPath(uri?: vscode.Uri): Promise<string | undefined> {
  if (uri?.fsPath && isVsdxPath(uri.fsPath)) {
    return uri.fsPath;
  }

  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      'Visio Drawing': ['vsdx']
    }
  });

  return selected?.[0]?.fsPath;
}

async function exportPreviewForFile(extensionRoot: string, filePath: string): Promise<PreviewExportResult> {
  const config = getRadarConfig();
  const paths = resolveWorkspacePaths(filePath, config.outputDirectory);
  const previewPath = resolvePreviewPath(filePath, paths.previewDir, config.previewFormat);
  const cacheIndex = await loadCacheIndex(paths.cacheIndexPath);

  await fs.mkdir(paths.previewDir, { recursive: true });

  if (await isPreviewFresh(cacheIndex, filePath, previewPath, config.previewFormat)) {
    const cachedRecord = cacheIndex.records[filePath];
    return {
      success: true,
      inputPath: filePath,
      outputPath: previewPath,
      outputPaths: cachedRecord?.previewPaths?.length ? cachedRecord.previewPaths : [previewPath],
      format: config.previewFormat,
      pageCount: cachedRecord?.exportedPageCount,
      cached: true
    };
  }

  const result = await exportVisioPreview(extensionRoot, filePath, previewPath, config);
  if (result.success) {
    await updatePreviewRecord(cacheIndex, filePath, previewPath, config.previewFormat, undefined, result.outputPaths, result.pageCount);
    await saveCacheIndex(paths.cacheIndexPath, cacheIndex);
  }

  return result;
}

async function runQaForFile(filePath: string, previewPathOverride?: string): Promise<QaResult & { qaPath: string; summaryPath: string }> {
  const config = getRadarConfig();
  const paths = resolveWorkspacePaths(filePath, config.outputDirectory);
  const qaPath = resolveQaPath(filePath, paths.qaDir);
  const summaryPath = resolveQaSummaryPath(qaPath);
  const cacheIndex = await loadCacheIndex(paths.cacheIndexPath);
  const previewPath = previewPathOverride ?? cacheIndex.records[filePath]?.previewPath;
  const result = await analyzeVsdx(filePath, previewPath, cacheIndex, config);

  await fs.mkdir(paths.qaDir, { recursive: true });
  await fs.writeFile(qaPath, JSON.stringify(result, null, 2), 'utf8');
  await fs.writeFile(summaryPath, toQaSummaryMarkdown(result), 'utf8');

  const record = cacheIndex.records[filePath];
  if (record) {
    record.qaPath = qaPath;
    record.updatedAt = new Date().toISOString();
    await saveCacheIndex(paths.cacheIndexPath, cacheIndex);
  }

  return Object.assign(result, { qaPath, summaryPath });
}

async function revealArtifactsForFile(filePath: string): Promise<void> {
  const config = getRadarConfig();
  const paths = resolveWorkspacePaths(filePath, config.outputDirectory);
  await Promise.all([
    fs.mkdir(paths.previewDir, { recursive: true }),
    fs.mkdir(paths.qaDir, { recursive: true })
  ]);

  output.appendLine(`[artifacts] ${path.basename(filePath)}`);
  output.appendLine(`  root=${paths.outputRoot}`);
  output.appendLine(`  previews=${paths.previewDir}`);
  output.appendLine(`  qa=${paths.qaDir}`);
  await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(paths.outputRoot));
}

async function generateWorkspaceReport(): Promise<WorkspaceReportResult> {
  const collection = await collectWorkspaceReportItems();
  return writeWorkspaceReport(
    collection,
    collection.items,
    'workspace-vsdx-report',
    'AI-FDE Workspace VSDX Report',
    'All workspace VSDX files'
  );
}

async function generateWorkspaceRiskReport(): Promise<WorkspaceReportResult> {
  const collection = await collectWorkspaceReportItems();
  const riskItems = collection.items.filter(item => item.badge !== 'OK');
  return writeWorkspaceReport(
    collection,
    riskItems,
    'workspace-vsdx-risk-report',
    'AI-FDE Workspace VSDX Risk Report',
    'Non-OK workspace VSDX files'
  );
}

async function generateWorkspaceDueRiskReport(): Promise<WorkspaceReportResult> {
  const collection = await collectWorkspaceReportItems();
  const dueRiskItems = filterDueRiskItems(collection.items);
  return writeWorkspaceReport(
    collection,
    dueRiskItems,
    'workspace-vsdx-due-risk-report',
    'AI-FDE Workspace Due VSDX Risk Report',
    'Non-OK workspace VSDX files that are overdue or due in 7 days'
  );
}

async function generateWorkspaceTeamBoard(): Promise<WorkspaceTeamBoardResult> {
  const collection = await collectWorkspaceReportItems();
  const reportDir = path.join(collection.reportRoot, 'reports');
  const jsonPath = path.join(reportDir, 'workspace-vsdx-team-board.json');
  const markdownPath = path.join(reportDir, 'workspace-vsdx-team-board.md');
  const generatedAt = new Date().toISOString();
  const today = generatedAt.slice(0, 10);
  const riskItems = sortRisksByDuePriority(collection.items.filter(item => item.badge !== 'OK'));
  const counts = countWorkspaceReportItems(riskItems);
  const ownerSummary = summarizeWorkspaceOwners(riskItems, today);
  const previewFreshnessSummary = summarizePreviewFreshnessReasonsForItems(riskItems);
  const lanes = buildWorkspaceTeamBoardLanes(riskItems, today);

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify({
    schemaVersion: 1,
    generatedAt,
    workspaceRoot: collection.workspaceRoot,
    notesPath: collection.notesPath,
    scope: 'Non-OK workspace VSDX files grouped by review status for team follow-up',
    sourceTotal: collection.items.length,
    total: riskItems.length,
    counts,
    ownerSummary,
    previewFreshnessSummary,
    lanes,
    items: riskItems
  }, null, 2), 'utf8');
  await fs.writeFile(markdownPath, toWorkspaceTeamBoardMarkdown(
    generatedAt,
    collection.workspaceRoot,
    collection.items.length,
    riskItems,
    counts,
    ownerSummary,
    previewFreshnessSummary,
    lanes
  ), 'utf8');

  return {
    jsonPath,
    markdownPath,
    generatedAt,
    total: riskItems.length,
    lanes,
    previewFreshnessSummary
  };
}

async function generateDemoPack(): Promise<DemoPackResult> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    throw new Error('Open a workspace folder before generating a demo pack.');
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const config = getRadarConfig();
  const reportRoot = path.isAbsolute(config.outputDirectory)
    ? config.outputDirectory
    : path.join(workspaceRoot, config.outputDirectory);
  const reportDir = path.join(reportRoot, 'reports');
  const jsonPath = path.join(reportDir, 'demo-pack.json');
  const markdownPath = path.join(reportDir, 'demo-pack.md');
  const generatedAt = new Date().toISOString();
  const version = await readWorkspacePackageVersion(workspaceRoot);
  const collection = await collectWorkspaceReportItems();
  const previewFreshnessSummary = summarizePreviewFreshnessReasonsForItems(collection.items.filter(item => item.badge !== 'OK'));
  const artifacts = [
    ...await collectDemoPackWorkspaceArtifacts(workspaceRoot, version),
    ...await collectDemoPackDirectoryArtifacts(path.join(reportRoot, 'acceptance'), 'acceptance', /^acceptance-.*\.(md|json)$/i, 'Acceptance'),
    ...await collectDemoPackDirectoryArtifacts(path.join(reportRoot, 'previews'), 'preview', /\.(png|pdf)$/i, 'Preview'),
    ...await collectDemoPackDirectoryArtifacts(path.join(reportRoot, 'qa'), 'qa-summary', /\.qa\.(md|json)$/i, 'QA'),
    ...await collectDemoPackDirectoryArtifacts(reportDir, 'report', /^(workspace-vsdx|qa-|demo-pack).*?\.(md|json|ics)$/i, 'Report')
  ].sort((left, right) => left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label));
  const previewArtifacts = artifacts.filter(artifact => artifact.kind === 'preview' && artifact.bytes > 100);
  const payload = {
    schemaVersion: 1,
    generatedAt,
    workspaceRoot,
    version,
    artifactCount: artifacts.length,
    previewGalleryCount: previewArtifacts.length,
    previewFreshnessSummaryCount: previewFreshnessSummary.length,
    previewFreshnessSummary,
    artifacts,
    storyboard: getDemoPackStoryboard()
  };

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  await fs.writeFile(markdownPath, toDemoPackMarkdown(payload, markdownPath), 'utf8');

  return {
    jsonPath,
    markdownPath,
    generatedAt,
    totalArtifacts: artifacts.length
  };
}

async function exportWorkspaceDueRiskCalendar(): Promise<WorkspaceDueCalendarResult> {
  const collection = await collectWorkspaceReportItems();
  const reportDir = path.join(collection.reportRoot, 'reports');
  const icsPath = path.join(reportDir, 'workspace-vsdx-due-risk-calendar.ics');
  const generatedAt = new Date().toISOString();
  const dueRiskItems = sortRisksByDuePriority(collection.items.filter(item =>
    item.badge !== 'OK' && normalizeDueDate(item.reviewDueDate)
  ));

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(icsPath, toWorkspaceDueRiskCalendarIcs(generatedAt, collection.workspaceRoot, dueRiskItems), 'utf8');

  return {
    icsPath,
    generatedAt,
    total: dueRiskItems.length
  };
}

async function generateQaConfigTemplate(): Promise<{ jsonPath: string; markdownPath: string; generatedAt: string }> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    throw new Error('Open a workspace folder before generating a QA config template.');
  }

  const config = getRadarConfig();
  const reportRoot = path.isAbsolute(config.outputDirectory)
    ? config.outputDirectory
    : path.join(workspaceFolders[0].uri.fsPath, config.outputDirectory);
  const reportDir = path.join(reportRoot, 'reports');
  const jsonPath = path.join(reportDir, 'qa-config-template.json');
  const markdownPath = path.join(reportDir, 'qa-config-template.md');
  const generatedAt = new Date().toISOString();
  const profiles = getQaConfigTemplateProfiles();
  const payload = {
    schemaVersion: 1,
    generatedAt,
    workspaceRoot: workspaceFolders[0].uri.fsPath,
    currentEffectiveConfig: config,
    profiles
  };

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  await fs.writeFile(markdownPath, toQaConfigTemplateMarkdown(payload), 'utf8');

  return { jsonPath, markdownPath, generatedAt };
}

async function generateQaProfileStrategyTemplate(): Promise<QaProfileStrategyTemplateResult> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    throw new Error('Open a workspace folder before generating a QA profile strategy template.');
  }

  const config = getRadarConfig();
  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const reportRoot = path.isAbsolute(config.outputDirectory)
    ? config.outputDirectory
    : path.join(workspaceRoot, config.outputDirectory);
  const reportDir = path.join(reportRoot, 'reports');
  const jsonPath = path.join(reportDir, 'qa-profile-strategy-template.json');
  const markdownPath = path.join(reportDir, 'qa-profile-strategy-template.md');
  const generatedAt = new Date().toISOString();
  const profiles = getQaConfigTemplateProfiles();
  const strategies = getQaProfileStrategies().map(strategy => {
    const resolvedProfiles = resolveQaProfileStrategyProfiles(strategy, profiles);
    return {
      ...strategy,
      profileNames: resolvedProfiles.map(toQaConfigProfileDisplayName),
      effectiveSettings: mergeQaConfigProfileSettings(resolvedProfiles)
    };
  });
  const payload = {
    schemaVersion: 1,
    generatedAt,
    workspaceRoot,
    profiles,
    strategies
  };

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  await fs.writeFile(markdownPath, toQaProfileStrategyTemplateMarkdown(payload), 'utf8');

  return {
    jsonPath,
    markdownPath,
    generatedAt,
    total: strategies.length
  };
}

async function exportQaConfig(): Promise<QaConfigExportResult> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    throw new Error('Open a workspace folder before exporting QA config.');
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const config = getRadarConfig();
  const reportRoot = path.isAbsolute(config.outputDirectory)
    ? config.outputDirectory
    : path.join(workspaceRoot, config.outputDirectory);
  const reportDir = path.join(reportRoot, 'reports');
  const jsonPath = path.join(reportDir, 'qa-config-export.json');
  const markdownPath = path.join(reportDir, 'qa-config-export.md');
  const generatedAt = new Date().toISOString();
  const settings = toPrefixedRadarConfigSettings(config);
  const payload = {
    schemaVersion: 1,
    generatedAt,
    workspaceRoot,
    settings
  };

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  await fs.writeFile(markdownPath, toQaConfigExportMarkdown(payload), 'utf8');

  return {
    jsonPath,
    markdownPath,
    generatedAt,
    total: Object.keys(settings).length
  };
}

async function importQaConfig(): Promise<QaConfigImportResult | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    throw new Error('Open a workspace folder before importing QA config.');
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const config = getRadarConfig();
  const reportRoot = path.isAbsolute(config.outputDirectory)
    ? config.outputDirectory
    : path.join(workspaceRoot, config.outputDirectory);
  const reportDir = path.join(reportRoot, 'reports');
  await fs.mkdir(reportDir, { recursive: true });

  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    defaultUri: vscode.Uri.file(reportDir),
    filters: {
      'JSON': ['json']
    },
    title: 'Import AI-FDE QA Config'
  });
  if (!selected?.length) {
    return undefined;
  }

  const sourcePath = selected[0].fsPath;
  const loaded = await loadQaConfigImportSettings(sourcePath);
  const previousEffectiveConfig = getRadarConfig();
  const applied = await updateWorkspaceQaConfigSettings(loaded.settings);
  if (Object.keys(applied.settings).length === 0) {
    throw new Error(`No supported QA config settings were found in ${sourcePath}.`);
  }

  const auditPath = await appendQaProfileAudit(
    workspaceRoot,
    previousEffectiveConfig,
    {
      name: toQaConfigImportAuditName(sourcePath, loaded.candidateName),
      namespace: 'import',
      description: `Imported QA config from ${sourcePath} (${loaded.candidateName}).`,
      settings: applied.settings
    }
  );

  return {
    sourcePath,
    sourceCandidate: loaded.candidateName,
    appliedCount: Object.keys(applied.settings).length,
    ignoredKeys: Array.from(new Set([...loaded.ignoredKeys, ...applied.ignoredKeys])).sort(),
    auditPath
  };
}

async function generateQaConfigDiffReport(): Promise<QaConfigDiffResult | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    throw new Error('Open a workspace folder before generating a QA config diff report.');
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const config = getRadarConfig();
  const reportRoot = path.isAbsolute(config.outputDirectory)
    ? config.outputDirectory
    : path.join(workspaceRoot, config.outputDirectory);
  const reportDir = path.join(reportRoot, 'reports');
  await fs.mkdir(reportDir, { recursive: true });

  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    defaultUri: vscode.Uri.file(reportDir),
    filters: {
      'JSON': ['json']
    },
    title: 'Compare AI-FDE QA Config'
  });
  if (!selected?.length) {
    return undefined;
  }

  const sourcePath = selected[0].fsPath;
  const source = await loadQaConfigImportSettings(sourcePath);
  if (Object.keys(source.settings).length === 0) {
    throw new Error(`No supported QA config settings were found in ${sourcePath}.`);
  }

  const generatedAt = new Date().toISOString();
  const jsonPath = path.join(reportDir, 'qa-config-diff.json');
  const markdownPath = path.join(reportDir, 'qa-config-diff.md');
  const currentSettings = toPrefixedRadarConfigSettings(config);
  const rows = toQaConfigDiffRows(currentSettings, source.settings);
  const counts = countQaConfigDiffRows(rows);
  const payload = {
    schemaVersion: 1,
    generatedAt,
    workspaceRoot,
    sourcePath,
    sourceCandidate: source.candidateName,
    ignoredKeys: source.ignoredKeys,
    counts,
    rows
  };

  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  await fs.writeFile(markdownPath, toQaConfigDiffMarkdown(payload), 'utf8');

  return {
    sourcePath,
    sourceCandidate: source.candidateName,
    jsonPath,
    markdownPath,
    generatedAt,
    same: counts.same,
    changed: counts.changed,
    missing: counts['missing-in-source'],
    ignoredKeys: source.ignoredKeys
  };
}

async function rollbackQaConfig(): Promise<QaConfigRollbackResult | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    throw new Error('Open a workspace folder before rolling back QA config.');
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const config = getRadarConfig();
  const reportRoot = path.isAbsolute(config.outputDirectory)
    ? config.outputDirectory
    : path.join(workspaceRoot, config.outputDirectory);
  const auditPath = path.join(reportRoot, 'reports', 'qa-profile-audit.json');
  const audit = await loadQaProfileAudit(auditPath, workspaceRoot);
  if (audit.readError) {
    throw new Error(`Could not read QA profile audit: ${audit.readError}`);
  }

  const candidates = audit.entries
    .filter(entry => Object.keys(entry.previousEffectiveConfig).length > 0)
    .sort((left, right) => right.appliedAt.localeCompare(left.appliedAt));
  if (candidates.length === 0) {
    throw new Error('No QA profile audit entries with previous config were found.');
  }

  const selected = await vscode.window.showQuickPick(
    candidates.map(entry => ({
      label: `${entry.appliedAt} - ${entry.profileName}`,
      description: entry.profileDescription,
      detail: 'Restore the QA config that was effective before this entry was applied.',
      entry
    })),
    {
      title: 'Roll Back AI-FDE QA Config',
      placeHolder: 'Select an audit entry to restore the config from before that change'
    }
  );
  if (!selected) {
    return undefined;
  }

  const previousEffectiveConfig = getRadarConfig();
  const applied = await updateWorkspaceQaConfigSettings(selected.entry.previousEffectiveConfig);
  if (Object.keys(applied.settings).length === 0) {
    throw new Error(`No supported previous QA config settings were found for ${selected.entry.profileName}.`);
  }

  const rollbackAuditPath = await appendQaProfileAudit(
    workspaceRoot,
    previousEffectiveConfig,
    {
      name: `rollback:${selected.entry.profileName}`,
      namespace: 'rollback',
      description: `Rolled back QA config to the state before ${selected.entry.profileName} at ${selected.entry.appliedAt}.`,
      settings: applied.settings
    }
  );

  return {
    profileName: selected.entry.profileName,
    appliedAt: selected.entry.appliedAt,
    appliedCount: Object.keys(applied.settings).length,
    ignoredKeys: applied.ignoredKeys,
    auditPath: rollbackAuditPath
  };
}

async function loadQaConfigImportSettings(sourcePath: string): Promise<{
  settings: Record<string, string | number | boolean>;
  ignoredKeys: string[];
  candidateName: string;
}> {
  const raw = await fs.readFile(sourcePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const candidates = extractQaConfigImportCandidates(parsed);
  if (candidates.length === 0) {
    return {
      settings: {},
      ignoredKeys: ['<root>'],
      candidateName: '<none>'
    };
  }

  const candidate = await selectQaConfigImportCandidate(candidates, sourcePath);
  if (!candidate) {
    return {
      settings: {},
      ignoredKeys: ['<selection-canceled>'],
      candidateName: '<selection-canceled>'
    };
  }

  return {
    ...normalizeRadarConfigSettings(candidate.settings),
    candidateName: candidate.name
  };
}

function extractQaConfigImportCandidates(value: unknown): QaConfigImportCandidate[] {
  if (!isRecord(value)) {
    return [];
  }

  const candidates: QaConfigImportCandidate[] = [];

  if (isRecord(value.settings)) {
    candidates.push({
      name: 'settings',
      description: 'Top-level settings',
      settings: value.settings
    });
  }

  if (isRecord(value.currentEffectiveConfig)) {
    candidates.push({
      name: 'currentEffectiveConfig',
      description: 'Current effective config from template or export',
      settings: value.currentEffectiveConfig
    });
  }

  if (Array.isArray(value.profiles)) {
    value.profiles.forEach((profile, index) => {
      if (!isRecord(profile) || !isRecord(profile.settings)) {
        return;
      }
      const namespace = typeof profile.namespace === 'string' && profile.namespace.trim().length > 0
        ? `${profile.namespace}/`
        : '';
      candidates.push({
        name: typeof profile.name === 'string' ? `profile:${namespace}${profile.name}` : `profile:${namespace}${index + 1}`,
        description: typeof profile.description === 'string' ? profile.description : 'Shared QA profile',
        settings: profile.settings
      });
    });
  }

  const hasConfigLikeKey = Object.keys(value).some(key => normalizeRadarConfigKey(key) !== undefined);
  if (hasConfigLikeKey) {
    candidates.push({
      name: 'root',
      description: 'Direct config key/value object',
      settings: value
    });
  }

  return candidates;
}

async function selectQaConfigImportCandidate(
  candidates: QaConfigImportCandidate[],
  sourcePath: string
): Promise<QaConfigImportCandidate | undefined> {
  if (candidates.length === 1) {
    return candidates[0];
  }

  const selected = await vscode.window.showQuickPick(
    candidates.map(candidate => ({
      label: candidate.name,
      description: candidate.description,
      detail: sourcePath,
      candidate
    })),
    {
      title: 'Select AI-FDE QA Config Source',
      placeHolder: 'Choose which settings/profile to use from this JSON file'
    }
  );
  return selected?.candidate;
}

function toQaConfigImportAuditName(sourcePath: string, candidateName: string): string {
  const basename = path.basename(sourcePath);
  return candidateName === 'settings'
    ? `import:${basename}`
    : `import:${basename}#${candidateName}`;
}

function normalizeRadarConfigSettings(value: Record<string, unknown>): {
  settings: Record<string, string | number | boolean>;
  ignoredKeys: string[];
} {
  const settings: Record<string, string | number | boolean> = {};
  const ignoredKeys: string[] = [];

  for (const [key, rawValue] of Object.entries(value)) {
    const configKey = normalizeRadarConfigKey(key);
    if (!configKey || !isValidRadarConfigValue(configKey, rawValue)) {
      ignoredKeys.push(key);
      continue;
    }

    settings[`aiFdeVsdxRadar.${configKey}`] = rawValue;
  }

  return { settings, ignoredKeys };
}

async function updateWorkspaceQaConfigSettings(settings: Record<string, string | number | boolean>): Promise<{
  settings: Record<string, string | number | boolean>;
  ignoredKeys: string[];
}> {
  const configuration = vscode.workspace.getConfiguration('aiFdeVsdxRadar');
  const applied: Record<string, string | number | boolean> = {};
  const ignoredKeys: string[] = [];

  for (const [key, value] of Object.entries(settings)) {
    const configKey = normalizeRadarConfigKey(key);
    if (!configKey || !isValidRadarConfigValue(configKey, value)) {
      ignoredKeys.push(key);
      continue;
    }

    await configuration.update(configKey, value, vscode.ConfigurationTarget.Workspace);
    applied[`aiFdeVsdxRadar.${configKey}`] = value;
  }

  return { settings: applied, ignoredKeys };
}

async function applyQaConfigProfile(): Promise<{ profile: QaConfigTemplateProfile; auditPath: string } | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    throw new Error('Open a workspace folder before applying a QA config profile.');
  }

  const selected = await vscode.window.showQuickPick(
    getQaConfigTemplateProfiles().map(profile => ({
      label: toQaConfigProfileDisplayName(profile),
      description: profile.description,
      profile
    })),
    {
      title: 'Apply AI-FDE QA Config Profile',
      placeHolder: 'Select a team QA profile to write into workspace settings'
    }
  );
  if (!selected) {
    return undefined;
  }

  const previousEffectiveConfig = getRadarConfig();
  const applied = await updateWorkspaceQaConfigSettings(selected.profile.settings);

  const auditPath = await appendQaProfileAudit(
    workspaceFolders[0].uri.fsPath,
    previousEffectiveConfig,
    {
      ...selected.profile,
      settings: applied.settings
    }
  );
  return { profile: selected.profile, auditPath };
}

async function applyQaConfigProfileStack(): Promise<QaConfigProfileStackResult | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    throw new Error('Open a workspace folder before applying a QA config profile stack.');
  }

  const selected = await vscode.window.showQuickPick(
    getQaConfigTemplateProfiles().map(profile => ({
      label: toQaConfigProfileDisplayName(profile),
      description: profile.description,
      profile
    })),
    {
      canPickMany: true,
      title: 'Apply AI-FDE QA Config Profile Stack',
      placeHolder: 'Select one or more team QA profiles; later profiles override earlier settings'
    }
  );
  if (!selected?.length) {
    return undefined;
  }

  const profiles = selected.map(item => item.profile);
  const profileNames = profiles.map(toQaConfigProfileDisplayName);
  const previousEffectiveConfig = getRadarConfig();
  const settings = mergeQaConfigProfileSettings(profiles);
  const applied = await updateWorkspaceQaConfigSettings(settings);
  const auditPath = await appendQaProfileAudit(
    workspaceFolders[0].uri.fsPath,
    previousEffectiveConfig,
    {
      name: `stack:${profileNames.join('+')}`,
      namespace: 'stack',
      description: `Applied QA config profile stack: ${profileNames.join(' -> ')}.`,
      settings: applied.settings
    }
  );

  return {
    profileNames,
    appliedCount: Object.keys(applied.settings).length,
    auditPath
  };
}

async function applyQaProfileStrategy(): Promise<QaProfileStrategyApplyResult | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    throw new Error('Open a workspace folder before applying a QA profile strategy.');
  }

  const profiles = getQaConfigTemplateProfiles();
  const selected = await vscode.window.showQuickPick(
    getQaProfileStrategies().map(strategy => ({
      label: toQaProfileStrategyDisplayName(strategy),
      description: strategy.description,
      detail: `${strategy.useWhen} Profiles: ${strategy.profiles.join(' -> ')}`,
      strategy
    })),
    {
      title: 'Apply AI-FDE QA Profile Strategy',
      placeHolder: 'Select a named strategy to apply its ordered profile stack'
    }
  );
  if (!selected) {
    return undefined;
  }

  const resolvedProfiles = resolveQaProfileStrategyProfiles(selected.strategy, profiles);
  const profileNames = resolvedProfiles.map(toQaConfigProfileDisplayName);
  const previousEffectiveConfig = getRadarConfig();
  const settings = mergeQaConfigProfileSettings(resolvedProfiles);
  const applied = await updateWorkspaceQaConfigSettings(settings);
  const auditPath = await appendQaProfileAudit(
    workspaceFolders[0].uri.fsPath,
    previousEffectiveConfig,
    {
      name: `strategy:${toQaProfileStrategyDisplayName(selected.strategy)}`,
      namespace: 'strategy',
      description: `Applied QA profile strategy ${toQaProfileStrategyDisplayName(selected.strategy)}: ${profileNames.join(' -> ')}.`,
      settings: applied.settings
    }
  );

  return {
    strategy: selected.strategy,
    profileNames,
    appliedCount: Object.keys(applied.settings).length,
    auditPath
  };
}

async function appendQaProfileAudit(
  workspaceRoot: string,
  previousEffectiveConfig: RadarConfig,
  profile: QaConfigTemplateProfile
): Promise<string> {
  const reportRoot = path.isAbsolute(previousEffectiveConfig.outputDirectory)
    ? previousEffectiveConfig.outputDirectory
    : path.join(workspaceRoot, previousEffectiveConfig.outputDirectory);
  const auditPath = path.join(reportRoot, 'reports', 'qa-profile-audit.json');
  const appliedAt = new Date().toISOString();
  let entries: QaProfileAuditEntry[] = [];

  if (existsSync(auditPath)) {
    try {
      const raw = await fs.readFile(auditPath, 'utf8');
      const parsed = JSON.parse(raw) as { entries?: unknown[] };
      entries = Array.isArray(parsed.entries)
        ? parsed.entries
          .map(normalizeQaProfileAuditEntry)
          .filter((entry): entry is QaProfileAuditEntry => Boolean(entry))
        : [];
    } catch {
      entries = [];
    }
  }

  entries.push({
    appliedAt,
    workspaceRoot,
    profileName: profile.name,
    profileDescription: profile.description,
    settings: profile.settings,
    previousEffectiveConfig: toPrimitiveRecord(previousEffectiveConfig)
  });

  await fs.mkdir(path.dirname(auditPath), { recursive: true });
  await fs.writeFile(auditPath, JSON.stringify({
    schemaVersion: 1,
    updatedAt: appliedAt,
    workspaceRoot,
    entries
  }, null, 2), 'utf8');
  return auditPath;
}

async function generateQaProfileAuditReport(): Promise<QaProfileAuditReportResult> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    throw new Error('Open a workspace folder before opening a QA profile audit report.');
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const config = getRadarConfig();
  const reportRoot = path.isAbsolute(config.outputDirectory)
    ? config.outputDirectory
    : path.join(workspaceRoot, config.outputDirectory);
  const reportDir = path.join(reportRoot, 'reports');
  const jsonPath = path.join(reportDir, 'qa-profile-audit.json');
  const markdownPath = path.join(reportDir, 'qa-profile-audit.md');
  const generatedAt = new Date().toISOString();
  const audit = await loadQaProfileAudit(jsonPath, workspaceRoot);

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(markdownPath, toQaProfileAuditMarkdown(generatedAt, jsonPath, audit), 'utf8');

  return {
    jsonPath,
    markdownPath,
    generatedAt,
    total: audit.entries.length
  };
}

async function loadQaProfileAudit(jsonPath: string, workspaceRoot: string): Promise<QaProfileAuditPayload> {
  if (!existsSync(jsonPath)) {
    return {
      updatedAt: '',
      workspaceRoot,
      entries: []
    };
  }

  try {
    const raw = await fs.readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      updatedAt?: unknown;
      workspaceRoot?: unknown;
      entries?: unknown[];
    };
    return {
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      workspaceRoot: typeof parsed.workspaceRoot === 'string' ? parsed.workspaceRoot : workspaceRoot,
      entries: Array.isArray(parsed.entries)
        ? parsed.entries
          .map(normalizeQaProfileAuditEntry)
          .filter((entry): entry is QaProfileAuditEntry => Boolean(entry))
        : []
    };
  } catch (error) {
    return {
      updatedAt: '',
      workspaceRoot,
      entries: [],
      readError: error instanceof Error ? error.message : String(error)
    };
  }
}

function getQaConfigTemplateProfiles(): QaConfigTemplateProfile[] {
  return [
    {
      name: 'delivery-review',
      namespace: 'delivery',
      description: 'Strict handoff review for diagrams that must be clean before delivery.',
      settings: {
        'aiFdeVsdxRadar.qaPreset': 'strict',
        'aiFdeVsdxRadar.enableShapeDensityWarning': true,
        'aiFdeVsdxRadar.enableConnectorRatioWarning': true,
        'aiFdeVsdxRadar.enableUnlabeledShapeWarning': true,
        'aiFdeVsdxRadar.enablePageCoverageWarning': true,
        'aiFdeVsdxRadar.enableDiagonalConnectorWarning': true,
        'aiFdeVsdxRadar.enableConnectorCrossingWarning': true,
        'aiFdeVsdxRadar.enableDanglingConnectorWarning': true,
        'aiFdeVsdxRadar.enableShapeOverlapWarning': true
      }
    },
    {
      name: 'inventory-quiet',
      namespace: 'inventory',
      description: 'Low-noise inventory pass for older diagrams where structural statistics matter more than layout warnings.',
      settings: {
        'aiFdeVsdxRadar.qaPreset': 'custom',
        'aiFdeVsdxRadar.shapeDensityWarningThreshold': 120,
        'aiFdeVsdxRadar.connectorRatioWarningThreshold': 0.1,
        'aiFdeVsdxRadar.pageCoverageLowWarningThreshold': 0.005,
        'aiFdeVsdxRadar.pageCoverageHighWarningThreshold': 0.95,
        'aiFdeVsdxRadar.enableShapeDensityWarning': false,
        'aiFdeVsdxRadar.enableConnectorRatioWarning': false,
        'aiFdeVsdxRadar.enableUnlabeledShapeWarning': false,
        'aiFdeVsdxRadar.enablePageCoverageWarning': false,
        'aiFdeVsdxRadar.enableDiagonalConnectorWarning': false,
        'aiFdeVsdxRadar.enableConnectorCrossingWarning': true,
        'aiFdeVsdxRadar.enableDanglingConnectorWarning': true,
        'aiFdeVsdxRadar.enableShapeOverlapWarning': false
      }
    },
    {
      name: 'layout-forensics',
      namespace: 'forensics',
      description: 'Focused layout review for crowded pages, connector routing, overlaps, and crossings.',
      settings: {
        'aiFdeVsdxRadar.qaPreset': 'custom',
        'aiFdeVsdxRadar.shapeDensityWarningThreshold': 60,
        'aiFdeVsdxRadar.connectorRatioWarningThreshold': 0.35,
        'aiFdeVsdxRadar.pageCoverageLowWarningThreshold': 0.04,
        'aiFdeVsdxRadar.pageCoverageHighWarningThreshold': 0.75,
        'aiFdeVsdxRadar.enableShapeDensityWarning': true,
        'aiFdeVsdxRadar.enableConnectorRatioWarning': true,
        'aiFdeVsdxRadar.enableUnlabeledShapeWarning': true,
        'aiFdeVsdxRadar.enablePageCoverageWarning': true,
        'aiFdeVsdxRadar.enableDiagonalConnectorWarning': true,
        'aiFdeVsdxRadar.enableConnectorCrossingWarning': true,
        'aiFdeVsdxRadar.enableDanglingConnectorWarning': true,
        'aiFdeVsdxRadar.enableShapeOverlapWarning': true
      }
    }
  ];
}

function getQaProfileStrategies(): QaProfileStrategy[] {
  return [
    {
      name: 'delivery-readiness',
      namespace: 'delivery',
      description: 'Final delivery gate that starts with routing/layout forensics and ends with strict handoff settings.',
      useWhen: 'Use before external delivery, milestone review, or release archive.',
      rationale: 'Combines detailed layout checks with the strict delivery profile so the last applied settings match the final handoff gate.',
      profiles: [
        'forensics/layout-forensics',
        'delivery/delivery-review'
      ]
    },
    {
      name: 'inventory-baseline',
      namespace: 'inventory',
      description: 'Low-noise baseline pass for large or older VSDX inventories.',
      useWhen: 'Use when onboarding a folder of historical diagrams and you need broad coverage without layout-noise overload.',
      rationale: 'Applies the quiet inventory profile so teams can first identify missing previews, stale QA, and hard errors.',
      profiles: [
        'inventory/inventory-quiet'
      ]
    },
    {
      name: 'layout-triage',
      namespace: 'forensics',
      description: 'Focused triage strategy for crowded diagrams, connector crossings, and overlap-heavy pages.',
      useWhen: 'Use when a diagram is visually dense or reviewers suspect connector routing and overlap issues.',
      rationale: 'Keeps the layout-forensics profile active so geometry warnings stay visible during remediation.',
      profiles: [
        'forensics/layout-forensics'
      ]
    }
  ];
}

function resolveQaProfileStrategyProfiles(
  strategy: QaProfileStrategy,
  profiles: QaConfigTemplateProfile[]
): QaConfigTemplateProfile[] {
  const profilesByName = new Map(profiles.map(profile => [toQaConfigProfileDisplayName(profile), profile]));

  return strategy.profiles.map(profileName => {
    const profile = profilesByName.get(profileName);
    if (!profile) {
      throw new Error(`QA profile strategy "${toQaProfileStrategyDisplayName(strategy)}" references missing profile "${profileName}".`);
    }
    return profile;
  });
}

function toQaProfileStrategyDisplayName(strategy: QaProfileStrategy): string {
  return `${strategy.namespace}/${strategy.name}`;
}

function toQaConfigTemplateMarkdown(payload: {
  generatedAt: string;
  workspaceRoot: string;
  currentEffectiveConfig: RadarConfig;
  profiles: QaConfigTemplateProfile[];
}): string {
  return [
    '# AI-FDE QA Config Template',
    '',
    `Generated: ${payload.generatedAt}`,
    `Workspace: \`${payload.workspaceRoot}\``,
    '',
    '## Current Effective Config',
    '',
    '| Setting | Value |',
    '| ------- | ----- |',
    ...Object.entries(payload.currentEffectiveConfig).map(([key, value]) => `| ${escapeMarkdownCell(`aiFdeVsdxRadar.${key}`)} | ${escapeMarkdownCell(String(value))} |`),
    '',
    '## Team Profiles',
    '',
    '| Namespace | Profile | Description | Key settings |',
    '| --------- | ------- | ----------- | ------------ |',
    ...payload.profiles.map(profile => `| ${escapeMarkdownCell(profile.namespace)} | ${escapeMarkdownCell(profile.name)} | ${escapeMarkdownCell(profile.description)} | ${escapeMarkdownCell(toProfileSettingsSummary(profile.settings))} |`),
    ''
  ].join('\n');
}

function toQaProfileStrategyTemplateMarkdown(payload: {
  generatedAt: string;
  workspaceRoot: string;
  profiles: QaConfigTemplateProfile[];
  strategies: Array<QaProfileStrategy & {
    profileNames: string[];
    effectiveSettings: Record<string, string | number | boolean>;
  }>;
}): string {
  return [
    '# AI-FDE QA Profile Strategy Template',
    '',
    `Generated: ${payload.generatedAt}`,
    `Workspace: \`${payload.workspaceRoot}\``,
    `Profiles: ${payload.profiles.length}`,
    `Strategies: ${payload.strategies.length}`,
    '',
    '## Strategy Catalog',
    '',
    '| Namespace | Strategy | Use when | Profiles | Key effective settings |',
    '| --------- | -------- | -------- | -------- | ---------------------- |',
    ...payload.strategies.map(strategy => `| ${[
      escapeMarkdownCell(strategy.namespace),
      escapeMarkdownCell(strategy.name),
      escapeMarkdownCell(strategy.useWhen),
      escapeMarkdownCell(strategy.profileNames.join(' -> ')),
      escapeMarkdownCell(toProfileSettingsSummary(strategy.effectiveSettings))
    ].join(' | ')} |`),
    '',
    '## Rationale',
    '',
    '| Strategy | Rationale |',
    '| -------- | --------- |',
    ...payload.strategies.map(strategy => `| ${escapeMarkdownCell(toQaProfileStrategyDisplayName(strategy))} | ${escapeMarkdownCell(strategy.rationale)} |`),
    '',
    '## Profile Catalog',
    '',
    '| Namespace | Profile | Description | Key settings |',
    '| --------- | ------- | ----------- | ------------ |',
    ...payload.profiles.map(profile => `| ${escapeMarkdownCell(profile.namespace)} | ${escapeMarkdownCell(profile.name)} | ${escapeMarkdownCell(profile.description)} | ${escapeMarkdownCell(toProfileSettingsSummary(profile.settings))} |`),
    ''
  ].join('\n');
}

function toQaConfigExportMarkdown(payload: {
  generatedAt: string;
  workspaceRoot: string;
  settings: Record<string, string | number | boolean>;
}): string {
  return [
    '# AI-FDE QA Config Export',
    '',
    `Generated: ${payload.generatedAt}`,
    `Workspace: \`${payload.workspaceRoot}\``,
    `Total settings: ${Object.keys(payload.settings).length}`,
    '',
    '## Settings',
    '',
    '| Setting | Value |',
    '| ------- | ----- |',
    ...Object.entries(payload.settings)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `| ${escapeMarkdownCell(key)} | ${escapeMarkdownCell(String(value))} |`),
    ''
  ].join('\n');
}

function toQaConfigDiffMarkdown(payload: {
  generatedAt: string;
  workspaceRoot: string;
  sourcePath: string;
  sourceCandidate: string;
  ignoredKeys: string[];
  counts: Record<QaConfigDiffStatus, number>;
  rows: QaConfigDiffRow[];
}): string {
  const lines = [
    '# AI-FDE QA Config Diff Report',
    '',
    `Generated: ${payload.generatedAt}`,
    `Workspace: \`${payload.workspaceRoot}\``,
    `Source JSON: \`${payload.sourcePath}\``,
    `Source candidate: ${payload.sourceCandidate}`,
    `Status: changed=${payload.counts.changed}, missing-in-source=${payload.counts['missing-in-source']}, same=${payload.counts.same}`,
    ''
  ];

  if (payload.ignoredKeys.length > 0) {
    lines.push(
      '## Ignored Source Keys',
      '',
      ...payload.ignoredKeys.map(key => `- ${key}`),
      ''
    );
  }

  lines.push(
    '## Settings',
    '',
    '| Setting | Current | Source | Status |',
    '| ------- | ------- | ------ | ------ |',
    ...payload.rows.map(row => `| ${[
      escapeMarkdownCell(row.setting),
      escapeMarkdownCell(String(row.currentValue)),
      escapeMarkdownCell(row.sourceValue === undefined ? '-' : String(row.sourceValue)),
      row.status
    ].join(' | ')} |`),
    ''
  );

  return lines.join('\n');
}

function toQaProfileAuditMarkdown(
  generatedAt: string,
  jsonPath: string,
  audit: QaProfileAuditPayload
): string {
  const entries = [...audit.entries].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  const lines = [
    '# AI-FDE QA Profile Audit Report',
    '',
    `Generated: ${generatedAt}`,
    `Workspace: \`${audit.workspaceRoot}\``,
    `Audit JSON: \`${jsonPath}\``,
    `Audit updated: ${audit.updatedAt || '-'}`,
    `Total entries: ${entries.length}`,
    ''
  ];

  if (audit.readError) {
    lines.push(
      '## Read Warning',
      '',
      `Could not read audit JSON: ${audit.readError}`,
      ''
    );
  }

  lines.push(
    '## Applied Profiles',
    '',
    '| Applied at | Profile | Description | Settings | Previous effective config |',
    '| ---------- | ------- | ----------- | -------- | ------------------------- |',
    ...toQaProfileAuditRows(entries),
    ''
  );

  return lines.join('\n');
}

function toQaProfileAuditRows(entries: QaProfileAuditEntry[]): string[] {
  if (entries.length === 0) {
    return ['| - | - | - | - | - |'];
  }

  return entries.map(entry => `| ${[
    escapeMarkdownCell(entry.appliedAt),
    escapeMarkdownCell(entry.profileName),
    escapeMarkdownCell(entry.profileDescription),
    escapeMarkdownCell(toProfileSettingsSummary(entry.settings)),
    escapeMarkdownCell(toProfileSettingsSummary(entry.previousEffectiveConfig))
  ].join(' | ')} |`);
}

function toProfileSettingsSummary(settings: Record<string, string | number | boolean>): string {
  const entries = Object.entries(settings);
  if (entries.length === 0) {
    return '-';
  }

  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
}

function toQaConfigProfileDisplayName(profile: QaConfigTemplateProfile): string {
  return `${profile.namespace}/${profile.name}`;
}

function mergeQaConfigProfileSettings(profiles: QaConfigTemplateProfile[]): Record<string, string | number | boolean> {
  return profiles.reduce<Record<string, string | number | boolean>>((settings, profile) => ({
    ...settings,
    ...profile.settings
  }), {});
}

function toPrefixedRadarConfigSettings(config: RadarConfig): Record<string, string | number | boolean> {
  return radarConfigKeys.reduce<Record<string, string | number | boolean>>((settings, key) => {
    settings[`aiFdeVsdxRadar.${key}`] = config[key];
    return settings;
  }, {});
}

function toQaConfigDiffRows(
  currentSettings: Record<string, string | number | boolean>,
  sourceSettings: Record<string, string | number | boolean>
): QaConfigDiffRow[] {
  return radarConfigKeys.map(key => {
    const setting = `aiFdeVsdxRadar.${key}`;
    const currentValue = currentSettings[setting];
    const hasSourceValue = Object.prototype.hasOwnProperty.call(sourceSettings, setting);
    const sourceValue = sourceSettings[setting];
    const status: QaConfigDiffStatus = !hasSourceValue
      ? 'missing-in-source'
      : Object.is(currentValue, sourceValue)
        ? 'same'
        : 'changed';

    return {
      setting,
      currentValue,
      sourceValue: hasSourceValue ? sourceValue : undefined,
      status
    };
  });
}

function countQaConfigDiffRows(rows: QaConfigDiffRow[]): Record<QaConfigDiffStatus, number> {
  return rows.reduce<Record<QaConfigDiffStatus, number>>((counts, row) => {
    counts[row.status] += 1;
    return counts;
  }, {
    same: 0,
    changed: 0,
    'missing-in-source': 0
  });
}

function normalizeRadarConfigKey(key: string): keyof RadarConfig | undefined {
  const stripped = key.replace(/^aiFdeVsdxRadar\./, '');
  return radarConfigKeySet.has(stripped) ? stripped as keyof RadarConfig : undefined;
}

function isValidRadarConfigValue(key: keyof RadarConfig, value: unknown): value is string | number | boolean {
  switch (key) {
    case 'pwshPath':
    case 'outputDirectory':
      return typeof value === 'string';
    case 'previewFormat':
      return value === 'png' || value === 'pdf';
    case 'qaPreset':
      return value === 'custom' || value === 'balanced' || value === 'strict' || value === 'quiet';
    case 'autoExportOnSave':
    case 'enableShapeDensityWarning':
    case 'enableConnectorRatioWarning':
    case 'enableUnlabeledShapeWarning':
    case 'enablePageCoverageWarning':
    case 'enableDiagonalConnectorWarning':
    case 'enableConnectorCrossingWarning':
    case 'enableDanglingConnectorWarning':
    case 'enableShapeOverlapWarning':
      return typeof value === 'boolean';
    case 'exportTimeoutMs':
    case 'shapeDensityWarningThreshold':
      return typeof value === 'number' && Number.isFinite(value) && value >= 1;
    case 'connectorRatioWarningThreshold':
    case 'pageCoverageLowWarningThreshold':
    case 'pageCoverageHighWarningThreshold':
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
    default:
      return false;
  }
}

function normalizeQaProfileAuditEntry(value: unknown): QaProfileAuditEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (typeof value.appliedAt !== 'string' || typeof value.profileName !== 'string') {
    return undefined;
  }

  return {
    appliedAt: value.appliedAt,
    workspaceRoot: typeof value.workspaceRoot === 'string' ? value.workspaceRoot : '',
    profileName: value.profileName,
    profileDescription: typeof value.profileDescription === 'string' ? value.profileDescription : '',
    settings: toPrimitiveRecord(value.settings),
    previousEffectiveConfig: toPrimitiveRecord(value.previousEffectiveConfig)
  };
}

function toPrimitiveRecord(value: unknown): Record<string, string | number | boolean> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string | number | boolean>>((record, [key, entryValue]) => {
    if (typeof entryValue === 'string' || typeof entryValue === 'number' || typeof entryValue === 'boolean') {
      record[key] = entryValue;
    }
    return record;
  }, {});
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function writeWorkspaceReport(
  collection: WorkspaceReportCollection,
  items: WorkspaceReportItem[],
  basename: string,
  title: string,
  scope: string
): Promise<WorkspaceReportResult> {
  const reportDir = path.join(collection.reportRoot, 'reports');
  const jsonPath = path.join(reportDir, `${basename}.json`);
  const markdownPath = path.join(reportDir, `${basename}.md`);
  const generatedAt = new Date().toISOString();
  const counts = countWorkspaceReportItems(items);
  const ownerSummary = summarizeWorkspaceOwners(items, generatedAt.slice(0, 10));
  const previewFreshnessSummary = summarizePreviewFreshnessReasonsForItems(items);

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify({
    schemaVersion: 1,
    generatedAt,
    workspaceRoot: collection.workspaceRoot,
    notesPath: collection.notesPath,
    scope,
    sourceTotal: collection.items.length,
    total: items.length,
    counts,
    ownerSummary,
    previewFreshnessSummary,
    items
  }, null, 2), 'utf8');
  await fs.writeFile(markdownPath, toWorkspaceReportMarkdown(generatedAt, collection.workspaceRoot, items, counts, ownerSummary, previewFreshnessSummary, title, scope, collection.items.length), 'utf8');

  return {
    jsonPath,
    markdownPath,
    generatedAt,
    total: items.length,
    counts,
    ownerSummary,
    previewFreshnessSummary
  };
}

async function collectWorkspaceReportItems(): Promise<WorkspaceReportCollection> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    throw new Error('Open a workspace folder before generating a VSDX report.');
  }

  const config = getRadarConfig();
  const reportRoot = path.isAbsolute(config.outputDirectory)
    ? config.outputDirectory
    : path.join(workspaceFolders[0].uri.fsPath, config.outputDirectory);
  const notesPath = resolveWorkspaceNotesPath(reportRoot);
  const notes = await loadWorkspaceRiskNotes(notesPath);
  const uris = await vscode.workspace.findFiles('**/*.vsdx', '**/{.aifde,.git,node_modules}/**');
  const items: WorkspaceReportItem[] = [];

  for (const uri of uris.sort((a, b) => a.fsPath.localeCompare(b.fsPath))) {
    const status = await getVsdxStatus(uri.fsPath);
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    const relativePath = folder
      ? path.relative(folder.uri.fsPath, uri.fsPath)
      : uri.fsPath;
    const note = notes[uri.fsPath];
    items.push({
      sourcePath: uri.fsPath,
      relativePath,
      badge: status.badge,
      statusRank: getStatusRank(status.badge),
      errors: status.errors,
      warnings: status.warnings,
      riskCodes: await readQaRiskCodes(status.qaPath),
      previewPath: status.previewPath,
      qaPath: status.qaPath,
      summaryPath: status.summaryPath,
      reviewStatus: normalizeReviewStatus(note?.status),
      reviewOwner: note?.owner ?? '',
      reviewDueDate: note?.dueDate ?? '',
      reviewNote: note?.note ?? '',
      reviewUpdatedAt: note?.updatedAt,
      tooltip: status.tooltip,
      previewFreshnessReasons: status.previewFreshnessReasons
    });
  }
  items.sort((a, b) => a.statusRank - b.statusRank || a.relativePath.localeCompare(b.relativePath));

  return {
    workspaceRoot: workspaceFolders[0].uri.fsPath,
    reportRoot,
    notesPath,
    items,
    counts: countWorkspaceReportItems(items)
  };
}

function countWorkspaceReportItems(items: WorkspaceReportItem[]): Record<string, number> {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.badge] = (accumulator[item.badge] ?? 0) + 1;
    return accumulator;
  }, {});
}

function summarizeWorkspaceOwners(items: WorkspaceReportItem[], today: string): WorkspaceOwnerSummaryItem[] {
  const summaries = new Map<string, WorkspaceOwnerSummaryItem>();

  for (const item of items) {
    const owner = item.reviewOwner.trim() || 'Unassigned';
    const summary = summaries.get(owner) ?? {
      owner,
      total: 0,
      risks: 0,
      overdue: 0,
      dueSoon: 0,
      reviewStatusCounts: createReviewStatusCounts()
    };
    const daysUntilDue = getDaysUntilDue(item.reviewDueDate, today);

    summary.total += 1;
    summary.risks += item.badge === 'OK' ? 0 : 1;
    summary.overdue += daysUntilDue !== undefined && daysUntilDue < 0 ? 1 : 0;
    summary.dueSoon += daysUntilDue !== undefined && daysUntilDue >= 0 && daysUntilDue <= 7 ? 1 : 0;
    summary.reviewStatusCounts[item.reviewStatus] += 1;
    summaries.set(owner, summary);
  }

  return Array.from(summaries.values()).sort((a, b) =>
    b.risks - a.risks
    || b.overdue - a.overdue
    || b.dueSoon - a.dueSoon
    || b.total - a.total
    || a.owner.localeCompare(b.owner)
  );
}

function createReviewStatusCounts(): Record<WorkspaceReviewStatus, number> {
  return reviewStatusOptions.reduce((accumulator, option) => {
    accumulator[option.value] = 0;
    return accumulator;
  }, {} as Record<WorkspaceReviewStatus, number>);
}

function buildWorkspaceTeamBoardLanes(items: WorkspaceReportItem[], today: string): WorkspaceTeamBoardLane[] {
  return reviewStatusOptions.map(option => {
    const laneItems = sortRisksByDuePriority(items.filter(item => item.reviewStatus === option.value));
    const dueCounts = countWorkspaceDueBuckets(laneItems, today);

    return {
      status: option.value,
      label: option.label,
      total: laneItems.length,
      counts: countWorkspaceReportItems(laneItems),
      overdue: dueCounts.overdue,
      dueSoon: dueCounts.dueSoon,
      owners: summarizeWorkspaceTeamBoardOwners(laneItems, today),
      items: laneItems
    };
  });
}

function summarizeWorkspaceTeamBoardOwners(items: WorkspaceReportItem[], today: string): WorkspaceTeamBoardOwnerItem[] {
  const summaries = new Map<string, WorkspaceTeamBoardOwnerItem>();

  for (const item of items) {
    const owner = item.reviewOwner.trim() || 'Unassigned';
    const summary = summaries.get(owner) ?? {
      owner,
      total: 0,
      counts: {},
      overdue: 0,
      dueSoon: 0,
      nextDueDate: ''
    };
    const daysUntilDue = getDaysUntilDue(item.reviewDueDate, today);

    summary.total += 1;
    summary.counts[item.badge] = (summary.counts[item.badge] ?? 0) + 1;
    summary.overdue += daysUntilDue !== undefined && daysUntilDue < 0 ? 1 : 0;
    summary.dueSoon += daysUntilDue !== undefined && daysUntilDue >= 0 && daysUntilDue <= 7 ? 1 : 0;
    summary.nextDueDate = getEarlierDueDate(summary.nextDueDate, item.reviewDueDate);
    summaries.set(owner, summary);
  }

  return Array.from(summaries.values()).sort((a, b) =>
    b.overdue - a.overdue
    || b.dueSoon - a.dueSoon
    || b.total - a.total
    || getDueSortValue(a.nextDueDate) - getDueSortValue(b.nextDueDate)
    || a.owner.localeCompare(b.owner)
  );
}

function countWorkspaceDueBuckets(items: WorkspaceReportItem[], today: string): { overdue: number; dueSoon: number } {
  return items.reduce((accumulator, item) => {
    const daysUntilDue = getDaysUntilDue(item.reviewDueDate, today);
    if (daysUntilDue !== undefined && daysUntilDue < 0) {
      accumulator.overdue += 1;
    } else if (daysUntilDue !== undefined && daysUntilDue <= 7) {
      accumulator.dueSoon += 1;
    }
    return accumulator;
  }, { overdue: 0, dueSoon: 0 });
}

function getEarlierDueDate(current: string, candidate: string): string {
  const currentDate = normalizeDueDate(current);
  const candidateDate = normalizeDueDate(candidate);
  if (!candidateDate) {
    return currentDate ?? '';
  }
  if (!currentDate) {
    return candidateDate;
  }
  return candidateDate < currentDate ? candidateDate : currentDate;
}

function getDueSortValue(dueDate: string): number {
  const normalized = normalizeDueDate(dueDate);
  if (!normalized) {
    return Number.MAX_SAFE_INTEGER;
  }
  const time = Date.parse(`${normalized}T00:00:00Z`);
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function filterDueRiskItems(items: WorkspaceReportItem[]): WorkspaceReportItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return sortRisksByDuePriority(items.filter(item => {
    const daysUntilDue = getDaysUntilDue(item.reviewDueDate, today);
    return item.badge !== 'OK' && daysUntilDue !== undefined && daysUntilDue <= 7;
  }));
}

async function showWorkspaceDueRiskReminder(collection: WorkspaceReportCollection): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const dueRiskItems = filterDueRiskItems(collection.items);
  const overdue = dueRiskItems.filter(item => {
    const daysUntilDue = getDaysUntilDue(item.reviewDueDate, today);
    return daysUntilDue !== undefined && daysUntilDue < 0;
  }).length;
  const dueSoon = dueRiskItems.length - overdue;

  output.appendLine(`[workspace-due-risk-reminder] overdue=${overdue} dueSoon=${dueSoon} total=${dueRiskItems.length}`);
  for (const item of dueRiskItems) {
    output.appendLine(`  ${item.reviewDueDate || '-'} ${item.badge} ${item.relativePath} owner=${item.reviewOwner || 'Unassigned'} review=${getReviewStatusLabel(item.reviewStatus)}`);
  }

  if (dueRiskItems.length === 0) {
    await vscode.window.showInformationMessage('AI-FDE VSDX Radar: no overdue or 7-day due VSDX risks found.');
    return;
  }

  const action = await vscode.window.showWarningMessage(
    `AI-FDE VSDX Radar: ${overdue} overdue and ${dueSoon} due within 7 days.`,
    'Open Dashboard',
    'Generate Due Report',
    'Open Next Due Risk'
  );

  if (action === 'Open Dashboard') {
    await vscode.commands.executeCommand('aiFdeVsdxRadar.openWorkspaceRiskDashboard');
  } else if (action === 'Generate Due Report') {
    await vscode.commands.executeCommand('aiFdeVsdxRadar.generateWorkspaceDueRiskReport');
  } else if (action === 'Open Next Due Risk') {
    await vscode.commands.executeCommand('aiFdeVsdxRadar.openNextDueRisk');
  }
}

function sortRisksByDuePriority(items: WorkspaceReportItem[]): WorkspaceReportItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return [...items].sort((a, b) => {
    const aDue = getDuePriority(a.reviewDueDate, today);
    const bDue = getDuePriority(b.reviewDueDate, today);
    return aDue.bucket - bDue.bucket
      || aDue.sortValue - bDue.sortValue
      || a.statusRank - b.statusRank
      || a.relativePath.localeCompare(b.relativePath);
  });
}

function getDuePriority(dueDate: string, today: string): { bucket: number; sortValue: number } {
  const normalized = normalizeDueDate(dueDate);
  if (!normalized) {
    return { bucket: 3, sortValue: Number.MAX_SAFE_INTEGER };
  }

  const daysUntilDue = getDaysUntilDue(normalized, today);
  if (daysUntilDue === undefined) {
    return { bucket: 3, sortValue: Number.MAX_SAFE_INTEGER };
  }

  const dueTime = Date.parse(`${normalized}T00:00:00Z`);
  if (daysUntilDue < 0) {
    return { bucket: 0, sortValue: dueTime };
  }
  if (daysUntilDue <= 7) {
    return { bucket: 1, sortValue: dueTime };
  }
  return { bucket: 2, sortValue: dueTime };
}

function getDaysUntilDue(dueDate: string, today: string): number | undefined {
  const normalized = normalizeDueDate(dueDate);
  if (!normalized) {
    return undefined;
  }

  const todayTime = Date.parse(`${today}T00:00:00Z`);
  const dueTime = Date.parse(`${normalized}T00:00:00Z`);
  if (Number.isNaN(todayTime) || Number.isNaN(dueTime)) {
    return undefined;
  }
  return Math.round((dueTime - todayTime) / 86400000);
}

function toWorkspaceDueRiskCalendarIcs(
  generatedAt: string,
  workspaceRoot: string,
  items: WorkspaceReportItem[]
): string {
  const stamp = toIcsTimestamp(generatedAt);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI-FDE//VSDX Radar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:AI-FDE VSDX Due Risks',
    `X-WR-CALDESC:${escapeIcsText(`Workspace: ${workspaceRoot}`)}`
  ];

  for (const item of items) {
    const dueDate = normalizeDueDate(item.reviewDueDate);
    if (!dueDate) {
      continue;
    }

    const owner = item.reviewOwner.trim() || 'Unassigned';
    const summary = `[${item.badge}] ${owner} - ${item.relativePath}`;
    const description = [
      `File: ${item.relativePath}`,
      `Badge: ${item.badge}`,
      `Review: ${getReviewStatusLabel(item.reviewStatus)}`,
      `Owner: ${owner}`,
      `Due: ${dueDate}`,
      `Risk codes: ${item.riskCodes.join(', ') || '-'}`,
      `Note: ${item.reviewNote || '-'}`,
      `QA summary: ${item.summaryPath}`,
      `Source: ${item.sourcePath}`
    ].join('\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${toWorkspaceDueRiskCalendarUid(item, dueDate)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dueDate.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${addDaysToIcsDate(dueDate, 1)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `CATEGORIES:${escapeIcsText(['AI-FDE', 'VSDX', item.badge, owner].join(','))}`,
      `URL:${escapeIcsText(item.summaryPath)}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR', '');
  return lines.map(foldIcsLine).join('\r\n');
}

function toWorkspaceDueRiskCalendarUid(item: WorkspaceReportItem, dueDate: string): string {
  return `${Buffer.from(`${item.sourcePath}|${dueDate}`).toString('base64url')}@ai-fde-vsdx-radar`;
}

function toIcsTimestamp(value: string): string {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function addDaysToIcsDate(date: string, days: number): string {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  const next = new Date(timestamp + days * 86400000);
  return next.toISOString().slice(0, 10).replace(/-/g, '');
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldIcsLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) {
    return line;
  }

  const chunks: string[] = [];
  let remaining = line;
  while (remaining.length > maxLength) {
    chunks.push(remaining.slice(0, maxLength));
    remaining = ` ${remaining.slice(maxLength)}`;
  }
  chunks.push(remaining);
  return chunks.join('\r\n');
}

function resolveWorkspaceNotesPath(reportRoot: string): string {
  return path.join(reportRoot, 'reports', 'workspace-vsdx-notes.json');
}

async function loadWorkspaceRiskNotes(notesPath: string): Promise<Record<string, WorkspaceRiskNote>> {
  if (!existsSync(notesPath)) {
    return {};
  }

  try {
    const raw = await fs.readFile(notesPath, 'utf8');
    const parsed = JSON.parse(raw) as { notes?: Record<string, Partial<WorkspaceRiskNote>> };
    const notes: Record<string, WorkspaceRiskNote> = {};
    for (const [sourcePath, note] of Object.entries(parsed.notes ?? {})) {
      notes[sourcePath] = {
        status: normalizeReviewStatus(note.status),
        owner: typeof note.owner === 'string' ? note.owner : '',
        dueDate: typeof note.dueDate === 'string' ? normalizeDueDate(note.dueDate) : '',
        note: typeof note.note === 'string' ? note.note : '',
        updatedAt: typeof note.updatedAt === 'string' ? note.updatedAt : ''
      };
    }
    return notes;
  } catch {
    return {};
  }
}

async function saveWorkspaceRiskNote(
  notesPath: string,
  sourcePath: string,
  status: WorkspaceReviewStatus,
  note: string,
  owner: string,
  dueDate: string
): Promise<WorkspaceRiskNote> {
  const saved = await saveWorkspaceRiskNotes(notesPath, [{
    sourcePath,
    status,
    note,
    owner,
    dueDate
  }]);
  return saved[sourcePath];
}

async function saveWorkspaceRiskNotes(
  notesPath: string,
  updates: WorkspaceRiskNoteUpdate[]
): Promise<Record<string, WorkspaceRiskNote>> {
  const notes = await loadWorkspaceRiskNotes(notesPath);
  const updatedAt = new Date().toISOString();
  const saved: Record<string, WorkspaceRiskNote> = {};
  for (const update of updates) {
    const existing = notes[update.sourcePath];
    const next: WorkspaceRiskNote = {
      status: normalizeReviewStatus(update.status ?? existing?.status),
      owner: update.owner !== undefined ? update.owner : existing?.owner ?? '',
      dueDate: update.dueDate !== undefined ? normalizeDueDate(update.dueDate) : existing?.dueDate ?? '',
      note: update.note !== undefined ? update.note : existing?.note ?? '',
      updatedAt
    };
    notes[update.sourcePath] = next;
    saved[update.sourcePath] = next;
  }

  await fs.mkdir(path.dirname(notesPath), { recursive: true });
  await fs.writeFile(notesPath, JSON.stringify({
    schemaVersion: 1,
    updatedAt,
    notes
  }, null, 2), 'utf8');
  return saved;
}

function normalizeReviewStatus(value: unknown): WorkspaceReviewStatus {
  return reviewStatusOptions.some(option => option.value === value)
    ? value as WorkspaceReviewStatus
    : defaultReviewStatus;
}

function getReviewStatusLabel(value: WorkspaceReviewStatus): string {
  return reviewStatusOptions.find(option => option.value === value)?.label ?? value;
}

function normalizeDueDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

async function readQaRiskCodes(qaPath: string): Promise<string[]> {
  if (!existsSync(qaPath)) {
    return [];
  }

  try {
    const raw = await fs.readFile(qaPath, 'utf8');
    const qa = JSON.parse(raw) as QaResult;
    return Array.from(new Set(qa.risks.map(risk => risk.code))).sort();
  } catch {
    return ['QA_READ_FAILED'];
  }
}

function toWorkspaceReportMarkdown(
  generatedAt: string,
  workspaceRoot: string,
  items: WorkspaceReportItem[],
  counts: Record<string, number>,
  ownerSummary: WorkspaceOwnerSummaryItem[],
  previewFreshnessSummary: PreviewFreshnessSummaryItem[],
  title = 'AI-FDE Workspace VSDX Report',
  scope = 'All workspace VSDX files',
  sourceTotal = items.length
): string {
  const countLabels = ['E', 'M', 'S', 'Q', 'R', 'OK']
    .map(label => `${label}=${counts[label] ?? 0}`)
    .join(', ');
  const attentionItems = items.filter(item => item.badge !== 'OK');

  return [
    `# ${title}`,
    '',
    `Generated: ${generatedAt}`,
    `Workspace: \`${workspaceRoot}\``,
    `Scope: ${scope}`,
    `Source total: ${sourceTotal}`,
    `Total: ${items.length}`,
    `Status: ${countLabels}`,
    '',
    '## Owner Summary',
    '',
    '| Owner | Total | Risks | Overdue | Due in 7 days | New | Reviewing | Accepted | Resolved |',
    '| ----- | ----- | ----- | ------- | ------------- | --- | --------- | -------- | -------- |',
    ...toWorkspaceOwnerSummaryRows(ownerSummary),
    '',
    '## Preview Freshness Summary',
    '',
    '| Reason | Count | Sample files |',
    '| ------ | ----- | ------------ |',
    ...toPreviewFreshnessSummaryRows(previewFreshnessSummary),
    '',
    '## Attention Needed',
    '',
    '| File | Badge | Errors | Warnings | Review | Owner | Due date | Note | Risk codes | Status detail | QA summary |',
    '| ---- | ----- | ------ | -------- | ------ | ----- | -------- | ---- | ---------- | ------------- | ---------- |',
    ...toWorkspaceReportRows(attentionItems),
    '',
    '## All Files',
    '',
    '| File | Badge | Errors | Warnings | Review | Owner | Due date | Note | Risk codes | Status detail | QA summary |',
    '| ---- | ----- | ------ | -------- | ------ | ----- | -------- | ---- | ---------- | ------------- | ---------- |',
    ...toWorkspaceReportRows(items),
    ''
  ].join('\n');
}

function toWorkspaceOwnerSummaryRows(items: WorkspaceOwnerSummaryItem[]): string[] {
  if (items.length === 0) {
    return ['| - | - | - | - | - | - | - | - | - |'];
  }

  return items.map(item => `| ${[
    escapeMarkdownCell(item.owner),
    String(item.total),
    String(item.risks),
    String(item.overdue),
    String(item.dueSoon),
    String(item.reviewStatusCounts.new),
    String(item.reviewStatusCounts.reviewing),
    String(item.reviewStatusCounts.accepted),
    String(item.reviewStatusCounts.resolved)
  ].join(' | ')} |`);
}

function toPreviewFreshnessSummaryRows(items: PreviewFreshnessSummaryItem[]): string[] {
  if (items.length === 0) {
    return ['| - | 0 | - |'];
  }

  return items.map(item => `| ${[
    escapeMarkdownCell(item.reason),
    String(item.count),
    escapeMarkdownCell(formatPreviewFreshnessSummaryFiles(item.files))
  ].join(' | ')} |`);
}

function toWorkspaceReportRows(items: WorkspaceReportItem[]): string[] {
  if (items.length === 0) {
    return ['| - | - | - | - | - | - | - | - | - | - | - |'];
  }

  return items.map(item => `| ${[
    escapeMarkdownCell(item.relativePath),
    item.badge,
    String(item.errors),
    String(item.warnings),
    getReviewStatusLabel(item.reviewStatus),
    escapeMarkdownCell(item.reviewOwner || '-'),
    escapeMarkdownCell(item.reviewDueDate || '-'),
    escapeMarkdownCell(item.reviewNote || '-'),
    escapeMarkdownCell(item.riskCodes.join(', ') || '-'),
    escapeMarkdownCell(formatWorkspaceStatusDetail(item)),
    escapeMarkdownCell(item.summaryPath)
  ].join(' | ')} |`);
}

function toWorkspaceTeamBoardMarkdown(
  generatedAt: string,
  workspaceRoot: string,
  sourceTotal: number,
  riskItems: WorkspaceReportItem[],
  counts: Record<string, number>,
  ownerSummary: WorkspaceOwnerSummaryItem[],
  previewFreshnessSummary: PreviewFreshnessSummaryItem[],
  lanes: WorkspaceTeamBoardLane[]
): string {
  const countLabels = ['E', 'M', 'S', 'Q', 'R']
    .map(label => `${label}=${counts[label] ?? 0}`)
    .join(', ');

  return [
    '# AI-FDE Workspace VSDX Team Review Board',
    '',
    `Generated: ${generatedAt}`,
    `Workspace: \`${workspaceRoot}\``,
    'Scope: Non-OK workspace VSDX files grouped by review status for team follow-up',
    `Source total: ${sourceTotal}`,
    `Risk total: ${riskItems.length}`,
    `Risk status: ${countLabels}`,
    '',
    '## Board Summary',
    '',
    '| Review | Total | E | M | S | Q | R | Overdue | Due in 7 days | Owners |',
    '| ------ | ----- | - | - | - | - | - | ------- | ------------- | ------ |',
    ...toWorkspaceTeamBoardSummaryRows(lanes),
    '',
    '## Owner Workload',
    '',
    '| Owner | Total | Risks | Overdue | Due in 7 days | New | Reviewing | Accepted | Resolved |',
    '| ----- | ----- | ----- | ------- | ------------- | --- | --------- | -------- | -------- |',
    ...toWorkspaceOwnerSummaryRows(ownerSummary),
    '',
    '## Preview Freshness Summary',
    '',
    '| Reason | Count | Sample files |',
    '| ------ | ----- | ------------ |',
    ...toPreviewFreshnessSummaryRows(previewFreshnessSummary),
    '',
    ...lanes.flatMap(toWorkspaceTeamBoardLaneSection),
    ''
  ].join('\n');
}

function toWorkspaceTeamBoardSummaryRows(lanes: WorkspaceTeamBoardLane[]): string[] {
  if (lanes.length === 0) {
    return ['| - | - | - | - | - | - | - | - | - | - |'];
  }

  return lanes.map(lane => `| ${[
    lane.label,
    String(lane.total),
    String(lane.counts.E ?? 0),
    String(lane.counts.M ?? 0),
    String(lane.counts.S ?? 0),
    String(lane.counts.Q ?? 0),
    String(lane.counts.R ?? 0),
    String(lane.overdue),
    String(lane.dueSoon),
    escapeMarkdownCell(formatWorkspaceTeamBoardOwners(lane.owners))
  ].join(' | ')} |`);
}

function toWorkspaceTeamBoardLaneSection(lane: WorkspaceTeamBoardLane): string[] {
  return [
    `## ${lane.label}`,
    '',
    `Total: ${lane.total}; overdue: ${lane.overdue}; due in 7 days: ${lane.dueSoon}`,
    '',
    '| File | Badge | Owner | Due date | Updated | Note | Risk codes | Status detail | QA summary |',
    '| ---- | ----- | ----- | -------- | ------- | ---- | ---------- | ------------- | ---------- |',
    ...toWorkspaceTeamBoardRows(lane.items),
    ''
  ];
}

function toWorkspaceTeamBoardRows(items: WorkspaceReportItem[]): string[] {
  if (items.length === 0) {
    return ['| - | - | - | - | - | - | - | - | - |'];
  }

  return items.map(item => `| ${[
    escapeMarkdownCell(item.relativePath),
    item.badge,
    escapeMarkdownCell(item.reviewOwner || 'Unassigned'),
    escapeMarkdownCell(item.reviewDueDate || '-'),
    escapeMarkdownCell(item.reviewUpdatedAt || '-'),
    escapeMarkdownCell(item.reviewNote || '-'),
    escapeMarkdownCell(item.riskCodes.join(', ') || '-'),
    escapeMarkdownCell(formatWorkspaceStatusDetail(item)),
    escapeMarkdownCell(item.summaryPath)
  ].join(' | ')} |`);
}

function formatWorkspaceTeamBoardOwners(owners: WorkspaceTeamBoardOwnerItem[]): string {
  if (owners.length === 0) {
    return '-';
  }

  return owners.map(owner => {
    const due = owner.nextDueDate ? `, next ${owner.nextDueDate}` : '';
    return `${owner.owner} (${owner.total}${due})`;
  }).join(', ');
}

async function readWorkspacePackageVersion(workspaceRoot: string): Promise<string> {
  const packagePath = path.join(workspaceRoot, 'package.json');
  if (!existsSync(packagePath)) {
    return '';
  }

  try {
    const parsed = JSON.parse(await fs.readFile(packagePath, 'utf8')) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : '';
  } catch {
    return '';
  }
}

async function collectDemoPackWorkspaceArtifacts(workspaceRoot: string, version: string): Promise<DemoPackArtifact[]> {
  const artifacts: DemoPackArtifact[] = [];
  const fixtureDir = path.join(workspaceRoot, 'test', 'fixtures');
  const vsixCandidates = await collectDemoPackDirectoryArtifacts(
    workspaceRoot,
    'vsix',
    version ? new RegExp(`^ai-fde-vsdx-radar-${escapeRegExp(version)}\\.vsix$`, 'i') : /^ai-fde-vsdx-radar-.*\.vsix$/i,
    'VSIX'
  );
  artifacts.push(...vsixCandidates.slice(0, 1));
  artifacts.push(...await collectDemoPackDirectoryArtifacts(fixtureDir, 'fixture', /\.vsdx$/i, 'Fixture'));
  return artifacts;
}

async function collectDemoPackDirectoryArtifacts(
  directory: string,
  kind: string,
  pattern: RegExp,
  labelPrefix: string
): Promise<DemoPackArtifact[]> {
  if (!existsSync(directory)) {
    return [];
  }

  const entries = await fs.readdir(directory, { withFileTypes: true });
  const artifacts: DemoPackArtifact[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !pattern.test(entry.name)) {
      continue;
    }
    const artifactPath = path.join(directory, entry.name);
    const stat = await fs.stat(artifactPath);
    artifacts.push({
      kind,
      label: `${labelPrefix}: ${entry.name}`,
      path: artifactPath,
      bytes: stat.size,
      modifiedAt: stat.mtime.toISOString()
    });
  }
  return artifacts.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt) || left.label.localeCompare(right.label));
}

function getDemoPackStoryboard(): Array<{ step: string; artifactHint: string; talkTrack: string }> {
  return [
    {
      step: 'Acceptance proof',
      artifactHint: '.aifde/acceptance/acceptance-*.md',
      talkTrack: 'Show PASS status, PowerShell 7.6.2, manifest command count, VSIX packaging, installation, and the route corpus QA evidence.'
    },
    {
      step: 'Single-page preview',
      artifactHint: '.aifde/previews/visio-com-smoke.png',
      talkTrack: 'Show how a VSDX becomes an inspectable PNG preview and QA summary inside the workspace.'
    },
    {
      step: 'Multi-page preview',
      artifactHint: '.aifde/previews/visio-com-multipage-smoke*.png',
      talkTrack: 'Show page-2/page-3 preview assets and explain multi-page coverage.'
    },
    {
      step: 'Connector route corpus',
      artifactHint: 'test/fixtures/connector-route-corpus.vsdx',
      talkTrack: 'Explain that complex connector routes are covered by automated QA without diagonal or crossing false positives.'
    },
    {
      step: 'Duplicate Shape ID corpus',
      artifactHint: 'test/fixtures/duplicate-shape-id-same-page-group-corpus.vsdx',
      talkTrack: 'Explain that same-page duplicate Shape IDs are surfaced and no longer suppress connector-crossing evidence.'
    },
    {
      step: 'Team risk workflow',
      artifactHint: '.aifde/reports/workspace-vsdx-team-board.md',
      talkTrack: 'Show owner workload, review lanes, due risk reminders, and how the dashboard persists remediation notes.'
    },
    {
      step: 'QA profile strategy',
      artifactHint: '.aifde/reports/qa-profile-strategy-template.md',
      talkTrack: 'Show reusable delivery-readiness, inventory-baseline, and layout-triage strategies for team settings.'
    }
  ];
}

function toDemoPackMarkdown(payload: {
  generatedAt: string;
  workspaceRoot: string;
  version: string;
  artifactCount: number;
  previewGalleryCount: number;
  previewFreshnessSummaryCount: number;
  previewFreshnessSummary: PreviewFreshnessSummaryItem[];
  artifacts: DemoPackArtifact[];
  storyboard: Array<{ step: string; artifactHint: string; talkTrack: string }>;
}, markdownPath: string): string {
  const previewArtifacts = payload.artifacts.filter(artifact => artifact.kind === 'preview' && artifact.bytes > 100);

  return [
    '# AI-FDE VSDX Demo Pack',
    '',
    `Generated: ${payload.generatedAt}`,
    `Workspace: \`${payload.workspaceRoot}\``,
    `Version: ${payload.version || '-'}`,
    `Artifacts: ${payload.artifactCount}`,
    `Preview gallery: ${payload.previewGalleryCount}`,
    `Preview freshness reasons: ${payload.previewFreshnessSummaryCount}`,
    '',
    '## Preview Freshness Summary',
    '',
    '| Reason | Count | Sample files |',
    '| ------ | ----- | ------------ |',
    ...toPreviewFreshnessSummaryRows(payload.previewFreshnessSummary),
    '',
    '## Presenter Storyboard',
    '',
    '| Step | Artifact hint | Talk track |',
    '| ---- | ------------- | ---------- |',
    ...payload.storyboard.map(item => `| ${escapeMarkdownCell(item.step)} | ${escapeMarkdownCell(item.artifactHint)} | ${escapeMarkdownCell(item.talkTrack)} |`),
    '',
    '## Preview Gallery',
    '',
    ...toDemoPackPreviewGalleryRows(previewArtifacts, markdownPath),
    '',
    '## Artifact Index',
    '',
    '| Kind | Label | Bytes | Modified | Path |',
    '| ---- | ----- | ----- | -------- | ---- |',
    ...toDemoPackArtifactRows(payload.artifacts),
    ''
  ].join('\n');
}

function toDemoPackPreviewGalleryRows(artifacts: DemoPackArtifact[], markdownPath: string): string[] {
  if (artifacts.length === 0) {
    return ['- No preview assets found.'];
  }

  return artifacts.flatMap(artifact => [
    `### ${artifact.label}`,
    '',
    `![${escapeMarkdownImageAlt(artifact.label)}](${toMarkdownRelativePath(markdownPath, artifact.path)})`,
    ''
  ]);
}

function toDemoPackArtifactRows(artifacts: DemoPackArtifact[]): string[] {
  if (artifacts.length === 0) {
    return ['| - | - | - | - | - |'];
  }

  return artifacts.map(artifact => `| ${[
    escapeMarkdownCell(artifact.kind),
    escapeMarkdownCell(artifact.label),
    String(artifact.bytes),
    escapeMarkdownCell(artifact.modifiedAt),
    escapeMarkdownCell(artifact.path)
  ].join(' | ')} |`);
}

function toMarkdownRelativePath(markdownPath: string, targetPath: string): string {
  const relative = path.relative(path.dirname(markdownPath), targetPath).replace(/\\/g, '/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function escapeMarkdownImageAlt(value: string): string {
  return value.replace(/[[\]()`]/g, ' ').trim() || 'preview';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getStatusRank(badge: string): number {
  const ranks: Record<string, number> = {
    E: 0,
    M: 1,
    S: 2,
    Q: 3,
    R: 4,
    OK: 5
  };
  return ranks[badge] ?? 99;
}

function resolveRiskOpenPath(item: WorkspaceReportItem): string {
  return existsSync(item.summaryPath) ? item.summaryPath : item.sourcePath;
}

function openWorkspaceRiskDashboard(
  context: vscode.ExtensionContext,
  collection: WorkspaceReportCollection,
  report: WorkspaceReportResult
): void {
  const panel = vscode.window.createWebviewPanel(
    'aiFdeVsdxRadar.riskDashboard',
    'AI-FDE VSDX Risk Dashboard',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  panel.webview.html = toWorkspaceRiskDashboardHtml(panel.webview, collection, report);
  const disposable = panel.webview.onDidReceiveMessage(async message => {
    if (!message || typeof message.command !== 'string') {
      return;
    }

    const targetPath = typeof message.path === 'string' ? message.path : undefined;
    if (message.command === 'openPath' && targetPath) {
      await openDashboardPath(targetPath);
      return;
    }

    if (message.command === 'saveNote' && typeof message.sourcePath === 'string') {
      try {
        const saved = await saveWorkspaceRiskNote(
          collection.notesPath,
          message.sourcePath,
          normalizeReviewStatus(message.status),
          typeof message.note === 'string' ? message.note : '',
          typeof message.owner === 'string' ? message.owner : '',
          typeof message.dueDate === 'string' ? message.dueDate : ''
        );
        output.appendLine(`[workspace-risk-note] ${message.sourcePath} status=${saved.status}`);
        await panel.webview.postMessage({
          command: 'noteSaved',
          sourcePath: message.sourcePath,
          status: saved.status,
          owner: saved.owner,
          dueDate: saved.dueDate,
          note: saved.note,
          updatedAt: saved.updatedAt
        });
      } catch (error) {
        await panel.webview.postMessage({
          command: 'noteSaveFailed',
          sourcePath: message.sourcePath,
          error: error instanceof Error ? error.message : String(error)
        });
        void vscode.window.showErrorMessage(`AI-FDE VSDX Radar failed to save note: ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }

    if (message.command === 'saveNotes' && Array.isArray(message.updates)) {
      try {
        const updates: WorkspaceRiskNoteUpdate[] = message.updates
          .filter((update: any) => typeof update?.sourcePath === 'string')
          .map((update: any) => ({
            sourcePath: update.sourcePath,
            status: typeof update.status === 'string' && update.status !== 'keep' ? normalizeReviewStatus(update.status) : undefined,
            owner: typeof update.owner === 'string' ? update.owner : undefined,
            dueDate: typeof update.dueDate === 'string' ? update.dueDate : undefined,
            note: typeof update.note === 'string' ? update.note : undefined
          }));
        const saved = await saveWorkspaceRiskNotes(collection.notesPath, updates);
        output.appendLine(`[workspace-risk-notes] saved=${Object.keys(saved).length}`);
        await panel.webview.postMessage({
          command: 'notesSaved',
          notes: saved
        });
      } catch (error) {
        await panel.webview.postMessage({
          command: 'notesSaveFailed',
          error: error instanceof Error ? error.message : String(error)
        });
        void vscode.window.showErrorMessage(`AI-FDE VSDX Radar failed to save notes: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });
  context.subscriptions.push(disposable);
}

async function openDashboardPath(targetPath: string): Promise<void> {
  if (!existsSync(targetPath)) {
    await vscode.window.showWarningMessage(`AI-FDE VSDX Radar: file not found: ${targetPath}`);
    return;
  }

  await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(targetPath), { preview: false });
}

function toWorkspaceRiskDashboardHtml(
  webview: vscode.Webview,
  collection: WorkspaceReportCollection,
  report: WorkspaceReportResult
): string {
  const nonce = createNonce();
  const statusLabels = ['E', 'M', 'S', 'Q', 'R', 'OK'];
  const riskCodes = Array.from(new Set(collection.items.flatMap(item => item.riskCodes))).sort();
  const owners = Array.from(new Set(collection.items.map(item => item.reviewOwner).filter(owner => owner.length > 0))).sort();
  const data = {
    workspaceRoot: collection.workspaceRoot,
    generatedAt: report.generatedAt,
    reportMarkdownPath: report.markdownPath,
    reportJsonPath: report.jsonPath,
    sourceTotal: collection.items.length,
    riskTotal: collection.items.filter(item => item.badge !== 'OK').length,
    today: new Date().toISOString().slice(0, 10),
    counts: collection.counts,
    statusLabels,
    riskCodes,
    owners,
    reviewStatuses: reviewStatusOptions,
    notesPath: collection.notesPath,
    previewFreshnessSummary: report.previewFreshnessSummary,
    items: collection.items.map(item => ({
      ...item,
      previewFreshnessReasonKeys: toPreviewFreshnessReasonKeys(item.previewFreshnessReasons)
    }))
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI-FDE VSDX Risk Dashboard</title>
  <style>
    :root {
      color-scheme: light dark;
    }

    body {
      margin: 0;
      padding: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    .shell {
      max-width: 1280px;
      margin: 0 auto;
      padding: 20px;
    }

    header {
      display: flex;
      gap: 16px;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    h1 {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 650;
    }

    .meta {
      margin: 0;
      color: var(--vscode-descriptionForeground);
      line-height: 1.6;
    }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    button,
    select,
    input,
    textarea {
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 4px;
      min-height: 30px;
      font: inherit;
    }

    button {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border-color: var(--vscode-button-border, transparent);
      padding: 4px 10px;
      cursor: pointer;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    button:disabled {
      opacity: 0.55;
      cursor: default;
    }

    button:disabled:hover {
      background: var(--vscode-button-background);
    }

    input,
    select,
    textarea {
      padding: 4px 8px;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 8px;
      margin: 16px 0;
    }

    .metric {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 10px;
      background: var(--vscode-sideBar-background);
    }

    .metric strong {
      display: block;
      margin-top: 4px;
      font-size: 20px;
    }

    .metric span {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    .preview-summary,
    .owner-summary {
      margin: 0 0 16px;
    }

    .section-title {
      margin: 0 0 8px;
      font-weight: 650;
    }

    .preview-table-wrap,
    .owner-table-wrap {
      overflow: auto;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
    }

    .preview-table {
      min-width: 760px;
    }

    .owner-table {
      min-width: 860px;
    }

    .preview-table th,
    .owner-table th {
      position: static;
    }

    .preview-table tbody tr[data-reason],
    .owner-table tbody tr {
      cursor: pointer;
    }

    .preview-table tbody tr[data-selected="true"] td,
    .owner-table tbody tr[data-selected="true"] td {
      color: var(--vscode-list-activeSelectionForeground);
      background: var(--vscode-list-activeSelectionBackground);
    }

    .toolbar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
      align-items: center;
      margin: 16px 0;
    }

    .bulkbar {
      display: grid;
      grid-template-columns: auto minmax(140px, 180px) minmax(140px, 180px) minmax(140px, 170px) minmax(180px, 1fr) auto minmax(120px, 150px);
      gap: 8px;
      align-items: center;
      margin: 0 0 16px;
      padding: 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-sideBar-background);
    }

    .bulk-note {
      box-sizing: border-box;
      width: 100%;
    }

    label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }

    input[type="checkbox"] {
      min-height: auto;
    }

    .table-wrap {
      overflow: auto;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1540px;
    }

    th,
    td {
      padding: 9px 10px;
      text-align: left;
      border-bottom: 1px solid var(--vscode-panel-border);
      vertical-align: top;
    }

    th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--vscode-editor-background);
      font-weight: 650;
    }

    tr:hover td {
      background: var(--vscode-list-hoverBackground);
    }

    .group-row td {
      background: var(--vscode-sideBar-background);
      color: var(--vscode-descriptionForeground);
      font-weight: 650;
    }

    .badge {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      min-width: 30px;
      min-height: 22px;
      border-radius: 4px;
      font-weight: 700;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
    }

    .badge[data-status="E"],
    .badge[data-status="M"] {
      background: var(--vscode-errorForeground);
      color: var(--vscode-editor-background);
    }

    .badge[data-status="S"],
    .badge[data-status="Q"],
    .badge[data-status="R"] {
      background: var(--vscode-editorWarning-foreground);
      color: var(--vscode-editor-background);
    }

    .badge[data-status="OK"] {
      background: var(--vscode-testing-iconPassed);
      color: var(--vscode-editor-background);
    }

    .path {
      font-family: var(--vscode-editor-font-family);
      word-break: break-word;
    }

    .codes {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .status-detail {
      display: block;
      min-width: 180px;
      max-width: 280px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.35;
    }

    .code {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 2px 5px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .row-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .review-select {
      width: 130px;
    }

    .owner-input {
      box-sizing: border-box;
      width: 150px;
    }

    .due-input {
      box-sizing: border-box;
      width: 150px;
    }

    .note-field {
      min-width: 220px;
    }

    .note-input {
      box-sizing: border-box;
      width: 100%;
      min-height: 30px;
      resize: vertical;
    }

    .save-state {
      display: block;
      min-height: 16px;
      margin-top: 3px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }

    .empty {
      padding: 28px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 6px;
    }

    @media (max-width: 760px) {
      header,
      .actions {
        display: block;
      }

      .actions {
        margin-top: 12px;
      }

      .toolbar {
        grid-template-columns: 1fr;
      }

      .bulkbar {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <div>
        <h1>AI-FDE VSDX Risk Dashboard</h1>
        <p class="meta" id="meta"></p>
      </div>
      <div class="actions">
        <button type="button" data-open-report="markdown">Open Markdown</button>
        <button type="button" data-open-report="json">Open JSON</button>
      </div>
    </header>

    <section class="summary" id="summary" aria-label="Status summary"></section>

    <section class="preview-summary" aria-label="Preview freshness summary">
      <p class="section-title">Preview Freshness Summary</p>
      <div class="preview-table-wrap">
        <table class="preview-table">
          <thead>
            <tr>
              <th>Reason</th>
              <th>Count</th>
              <th>Sample files</th>
            </tr>
          </thead>
          <tbody id="previewRows"></tbody>
        </table>
      </div>
    </section>

    <section class="owner-summary" aria-label="Owner summary">
      <p class="section-title">Owner Summary</p>
      <div class="owner-table-wrap">
        <table class="owner-table">
          <thead>
            <tr>
              <th>Owner</th>
              <th>Total</th>
              <th>Risks</th>
              <th>Overdue</th>
              <th>Due soon</th>
              <th>New</th>
              <th>Reviewing</th>
              <th>Accepted</th>
              <th>Resolved</th>
            </tr>
          </thead>
          <tbody id="ownerRows"></tbody>
        </table>
      </div>
    </section>

    <section class="toolbar" aria-label="Filters">
      <input id="search" type="search" placeholder="Search file or risk code">
      <select id="statusFilter" aria-label="Status filter"></select>
      <select id="riskFilter" aria-label="Risk code filter"></select>
      <select id="reasonFilter" aria-label="Preview freshness reason filter"></select>
      <select id="reviewFilter" aria-label="Review status filter"></select>
      <select id="ownerFilter" aria-label="Owner filter"></select>
      <select id="sortBy" aria-label="Sort rows"></select>
      <select id="groupBy" aria-label="Group rows"></select>
      <label><input id="riskOnly" type="checkbox" checked> Only risks</label>
      <button type="button" id="resetFilters">Reset filters</button>
    </section>

    <section class="bulkbar" aria-label="Bulk actions">
      <label><input id="selectVisible" type="checkbox"> Select visible</label>
      <select id="bulkStatus" aria-label="Bulk review status"></select>
      <input id="bulkOwner" type="text" placeholder="Owner">
      <input id="bulkDueDate" type="date" aria-label="Bulk due date">
      <input id="bulkNote" class="bulk-note" type="text" placeholder="Remediation note">
      <button type="button" id="applyBulk">Apply</button>
      <span id="bulkState"></span>
    </section>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Select</th>
            <th>Status</th>
            <th>File</th>
            <th>Errors</th>
            <th>Warnings</th>
            <th>Review</th>
            <th>Owner</th>
            <th>Due date</th>
            <th>Note</th>
            <th>Risk codes</th>
            <th>Status detail</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <div class="empty" id="empty" hidden>No matching VSDX files.</div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const dashboard = ${toScriptJson(data)};
    const state = {
      search: '',
      status: 'all',
      riskCode: 'all',
      previewReason: 'all',
      reviewStatus: 'all',
      owner: 'all',
      sortBy: 'risk',
      groupBy: 'status',
      riskOnly: true
    };
    const selected = new Set();
    let visibleItems = [];

    const rows = document.getElementById('rows');
    const previewRows = document.getElementById('previewRows');
    const ownerRows = document.getElementById('ownerRows');
    const empty = document.getElementById('empty');
    const search = document.getElementById('search');
    const statusFilter = document.getElementById('statusFilter');
    const riskFilter = document.getElementById('riskFilter');
    const reasonFilter = document.getElementById('reasonFilter');
    const reviewFilter = document.getElementById('reviewFilter');
    const ownerFilter = document.getElementById('ownerFilter');
    const sortBy = document.getElementById('sortBy');
    const groupBy = document.getElementById('groupBy');
    const riskOnly = document.getElementById('riskOnly');
    const resetFilters = document.getElementById('resetFilters');
    const selectVisible = document.getElementById('selectVisible');
    const bulkStatus = document.getElementById('bulkStatus');
    const bulkOwner = document.getElementById('bulkOwner');
    const bulkDueDate = document.getElementById('bulkDueDate');
    const bulkNote = document.getElementById('bulkNote');
    const applyBulk = document.getElementById('applyBulk');
    const bulkState = document.getElementById('bulkState');

    document.getElementById('meta').textContent =
      dashboard.workspaceRoot + ' · ' + dashboard.generatedAt + ' · total ' + dashboard.sourceTotal + ', risks ' + dashboard.riskTotal;

    document.querySelector('[data-open-report="markdown"]').addEventListener('click', () => openPath(dashboard.reportMarkdownPath));
    document.querySelector('[data-open-report="json"]').addEventListener('click', () => openPath(dashboard.reportJsonPath));

    renderSummary();
    renderPreviewFreshnessSummary();
    renderOwnerSummary();
    renderFilters();
    renderRows();

    search.addEventListener('input', event => {
      state.search = event.target.value.trim().toLowerCase();
      renderRows();
    });
    statusFilter.addEventListener('change', event => {
      state.status = event.target.value;
      renderRows();
    });
    riskFilter.addEventListener('change', event => {
      state.riskCode = event.target.value;
      renderRows();
    });
    reasonFilter.addEventListener('change', event => {
      state.previewReason = event.target.value;
      renderPreviewFreshnessSummary();
      renderRows();
    });
    reviewFilter.addEventListener('change', event => {
      state.reviewStatus = event.target.value;
      renderRows();
    });
    ownerFilter.addEventListener('change', event => {
      state.owner = event.target.value;
      renderOwnerSummary();
      renderRows();
    });
    sortBy.addEventListener('change', event => {
      state.sortBy = event.target.value;
      renderRows();
    });
    groupBy.addEventListener('change', event => {
      state.groupBy = event.target.value;
      renderRows();
    });
    riskOnly.addEventListener('change', event => {
      state.riskOnly = event.target.checked;
      renderRows();
    });
    resetFilters.addEventListener('click', () => resetDashboardFilters());
    selectVisible.addEventListener('change', event => {
      if (event.target.checked) {
        visibleItems.forEach(item => selected.add(item.sourcePath));
      } else {
        visibleItems.forEach(item => selected.delete(item.sourcePath));
      }
      renderRows();
    });
    applyBulk.addEventListener('click', () => {
      const sourcePaths = Array.from(selected);
      if (!sourcePaths.length) {
        bulkState.textContent = 'No selection';
        return;
      }
      const owner = bulkOwner.value.trim();
      const dueDate = bulkDueDate.value;
      const note = bulkNote.value.trim();
      if (bulkStatus.value === 'keep' && owner.length === 0 && dueDate.length === 0 && note.length === 0) {
        bulkState.textContent = 'No change';
        return;
      }
      bulkState.textContent = 'Saving';
      vscode.postMessage({
        command: 'saveNotes',
        updates: sourcePaths.map(sourcePath => {
          return {
            sourcePath,
            status: bulkStatus.value,
            owner: owner.length > 0 ? owner : undefined,
            dueDate: dueDate.length > 0 ? dueDate : undefined,
            note: note.length > 0 ? note : undefined
          };
        })
      });
    });

    window.addEventListener('message', event => {
      const message = event.data || {};
      if (message.command === 'noteSaved') {
        const item = dashboard.items.find(candidate => candidate.sourcePath === message.sourcePath);
        if (item) {
          item.reviewStatus = message.status;
          item.reviewOwner = message.owner || '';
          item.reviewDueDate = message.dueDate || '';
          item.reviewNote = message.note;
          item.reviewUpdatedAt = message.updatedAt;
        }
        markSaveState(message.sourcePath, 'Saved');
        refreshDashboardViews();
      }
      if (message.command === 'notesSaved') {
        Object.entries(message.notes || {}).forEach(([sourcePath, note]) => {
          const item = dashboard.items.find(candidate => candidate.sourcePath === sourcePath);
          if (item) {
            item.reviewStatus = note.status;
            item.reviewOwner = note.owner || '';
            item.reviewDueDate = note.dueDate || '';
            item.reviewNote = note.note;
            item.reviewUpdatedAt = note.updatedAt;
          }
          markSaveState(sourcePath, 'Saved');
        });
        bulkOwner.value = '';
        bulkDueDate.value = '';
        bulkNote.value = '';
        refreshDashboardViews();
        bulkState.textContent = 'Saved';
      }
      if (message.command === 'noteSaveFailed') {
        markSaveState(message.sourcePath, 'Save failed');
      }
      if (message.command === 'notesSaveFailed') {
        bulkState.textContent = 'Save failed';
      }
    });

    function refreshDashboardViews() {
      renderSummary();
      renderPreviewFreshnessSummary();
      renderFilters();
      renderOwnerSummary();
      renderRows();
    }

    function renderSummary() {
      const summary = document.getElementById('summary');
      const ownerCount = new Set(dashboard.items.map(item => item.reviewOwner).filter(value => value)).size;
      const overdueCount = dashboard.items.filter(item => dueBucket(item) === 'Overdue').length;
      const dueSoonCount = dashboard.items.filter(item => dueBucket(item) === 'Due in 7 days').length;
      const metrics = [
        ['Total', dashboard.sourceTotal],
        ['Risks', dashboard.riskTotal],
        ['Owners', ownerCount],
        ['Overdue', overdueCount],
        ['Due soon', dueSoonCount],
        ...dashboard.statusLabels.map(label => [label, dashboard.counts[label] || 0])
      ];
      summary.replaceChildren(...metrics.map(([label, value]) => {
        const node = document.createElement('div');
        node.className = 'metric';
        const caption = document.createElement('span');
        caption.textContent = label;
        const number = document.createElement('strong');
        number.textContent = String(value);
        node.append(caption, number);
        return node;
      }));
    }

    function renderPreviewFreshnessSummary() {
      const items = Array.isArray(dashboard.previewFreshnessSummary) ? dashboard.previewFreshnessSummary : [];
      previewRows.replaceChildren(...previewFreshnessSummaryRows(items));
    }

    function previewFreshnessSummaryRows(items) {
      if (!items.length) {
        const tr = document.createElement('tr');
        tr.append(cell(text('-')), cell(text('0')), cell(text('-')));
        return [tr];
      }
      return items.map(item => {
        const tr = document.createElement('tr');
        const reason = item.reason || '';
        tr.tabIndex = 0;
        tr.dataset.reason = reason;
        tr.dataset.selected = state.previewReason === reason ? 'true' : 'false';
        tr.title = reason ? 'Filter by ' + reason : '';
        tr.append(
          cell(text(reason || '-', 'path')),
          cell(text(String(item.count || 0))),
          cell(text(formatPreviewSummaryFiles(item.files || []), 'status-detail'))
        );
        tr.addEventListener('click', () => setPreviewReasonFilter(reason));
        tr.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setPreviewReasonFilter(reason);
          }
        });
        return tr;
      });
    }

    function formatPreviewSummaryFiles(files) {
      const visible = files.slice(0, 3);
      const suffix = files.length > visible.length ? '; +' + (files.length - visible.length) + ' more' : '';
      return visible.join('; ') + suffix || '-';
    }

    function renderOwnerSummary() {
      ownerRows.replaceChildren(...ownerSummaryItems().map(summary => {
        const tr = document.createElement('tr');
        tr.tabIndex = 0;
        tr.dataset.selected = state.owner === summary.owner ? 'true' : 'false';
        tr.append(
          cell(text(summary.owner, 'path')),
          cell(text(String(summary.total))),
          cell(text(String(summary.risks))),
          cell(text(String(summary.overdue))),
          cell(text(String(summary.dueSoon))),
          cell(text(String(summary.statusCounts.new))),
          cell(text(String(summary.statusCounts.reviewing))),
          cell(text(String(summary.statusCounts.accepted))),
          cell(text(String(summary.statusCounts.resolved)))
        );
        tr.addEventListener('click', () => setOwnerFilter(summary.owner));
        tr.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOwnerFilter(summary.owner);
          }
        });
        return tr;
      }));
    }

    function ownerSummaryItems() {
      const summaries = new Map();
      dashboard.items.forEach(item => {
        const owner = ownerValue(item);
        if (!summaries.has(owner)) {
          summaries.set(owner, {
            owner,
            total: 0,
            risks: 0,
            overdue: 0,
            dueSoon: 0,
            statusCounts: createStatusCounts()
          });
        }
        const summary = summaries.get(owner);
        const due = dueBucket(item);
        const status = item.reviewStatus || 'new';
        summary.total += 1;
        summary.risks += item.badge === 'OK' ? 0 : 1;
        summary.overdue += due === 'Overdue' ? 1 : 0;
        summary.dueSoon += due === 'Due in 7 days' ? 1 : 0;
        summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;
      });

      return Array.from(summaries.values()).sort((a, b) =>
        b.risks - a.risks
        || b.overdue - a.overdue
        || b.dueSoon - a.dueSoon
        || b.total - a.total
        || a.owner.localeCompare(b.owner)
      );
    }

    function createStatusCounts() {
      return dashboard.reviewStatuses.reduce((accumulator, status) => {
        accumulator[status.value] = 0;
        return accumulator;
      }, {});
    }

    function renderFilters() {
      statusFilter.replaceChildren(option('all', 'All statuses'), ...dashboard.statusLabels.map(label => option(label, label)));
      riskFilter.replaceChildren(option('all', 'All risk codes'), ...dashboard.riskCodes.map(code => option(code, code)));
      const previewReasons = previewFreshnessReasonOptions();
      if (state.previewReason !== 'all' && !previewReasons.includes(state.previewReason)) {
        state.previewReason = 'all';
      }
      reasonFilter.replaceChildren(option('all', 'All freshness reasons'), ...previewReasons.map(reason => option(reason, reason)));
      reviewFilter.replaceChildren(option('all', 'All review states'), ...dashboard.reviewStatuses.map(status => option(status.value, status.label)));
      const ownerOptions = ownerSummaryItems().map(summary => summary.owner);
      if (state.owner !== 'all' && !ownerOptions.includes(state.owner)) {
        state.owner = 'all';
      }
      ownerFilter.replaceChildren(option('all', 'All owners'), ...ownerOptions.map(owner => option(owner, owner)));
      sortBy.replaceChildren(
        option('risk', 'Sort by risk'),
        option('due', 'Sort by due date'),
        option('owner', 'Sort by owner'),
        option('review', 'Sort by review'),
        option('file', 'Sort by file')
      );
      groupBy.replaceChildren(
        option('none', 'No grouping'),
        option('status', 'Group by status'),
        option('review', 'Group by review'),
        option('owner', 'Group by owner'),
        option('due', 'Group by due date'),
        option('risk', 'Group by risk')
      );
      statusFilter.value = state.status;
      riskFilter.value = state.riskCode;
      reasonFilter.value = state.previewReason;
      reviewFilter.value = state.reviewStatus;
      ownerFilter.value = state.owner;
      sortBy.value = state.sortBy;
      groupBy.value = state.groupBy;
      riskOnly.checked = state.riskOnly;
      bulkStatus.replaceChildren(option('keep', 'Keep status'), ...dashboard.reviewStatuses.map(status => option(status.value, status.label)));
    }

    function renderRows() {
      const filtered = dashboard.items.filter(item => {
        const text = [
          item.relativePath,
          item.badge,
          item.tooltip,
          item.reviewStatus,
          ownerValue(item),
          item.reviewDueDate,
          item.reviewNote,
          ...item.riskCodes,
          ...(item.previewFreshnessReasons || [])
        ].join(' ').toLowerCase();
        return (!state.riskOnly || item.badge !== 'OK')
          && (state.status === 'all' || item.badge === state.status)
          && (state.riskCode === 'all' || item.riskCodes.includes(state.riskCode))
          && (state.previewReason === 'all' || previewReasonMatches(item, state.previewReason))
          && (state.reviewStatus === 'all' || item.reviewStatus === state.reviewStatus)
          && (state.owner === 'all' || ownerValue(item) === state.owner)
          && (!state.search || text.includes(state.search));
      });
      const sorted = sortDashboardItems(filtered);

      visibleItems = sorted;
      rows.replaceChildren(...renderGroupedRows(sorted));
      empty.hidden = sorted.length > 0;
      selectVisible.checked = sorted.length > 0 && sorted.every(item => selected.has(item.sourcePath));
      selectVisible.indeterminate = sorted.some(item => selected.has(item.sourcePath)) && !selectVisible.checked;
      bulkState.textContent = selected.size ? selected.size + ' selected' : '';
      resetFilters.disabled = !hasActiveFilters();
    }

    function sortDashboardItems(items) {
      return [...items].sort((a, b) => {
        if (state.sortBy === 'due') {
          return compareDue(a, b) || compareRisk(a, b);
        }
        if (state.sortBy === 'owner') {
          return ownerValue(a).localeCompare(ownerValue(b))
            || compareDue(a, b)
            || compareRisk(a, b);
        }
        if (state.sortBy === 'review') {
          return reviewLabel(a.reviewStatus).localeCompare(reviewLabel(b.reviewStatus))
            || compareDue(a, b)
            || compareRisk(a, b);
        }
        if (state.sortBy === 'file') {
          return a.relativePath.localeCompare(b.relativePath);
        }
        return compareRisk(a, b);
      });
    }

    function compareRisk(a, b) {
      return (a.statusRank ?? 99) - (b.statusRank ?? 99)
        || a.relativePath.localeCompare(b.relativePath);
    }

    function compareDue(a, b) {
      const aDue = duePriority(a);
      const bDue = duePriority(b);
      return aDue.bucket - bDue.bucket
        || aDue.sortValue - bDue.sortValue
        || a.relativePath.localeCompare(b.relativePath);
    }

    function duePriority(item) {
      if (!item.reviewDueDate) {
        return { bucket: 3, sortValue: Number.MAX_SAFE_INTEGER };
      }
      const dueTime = new Date(item.reviewDueDate + 'T00:00:00').getTime();
      if (Number.isNaN(dueTime)) {
        return { bucket: 3, sortValue: Number.MAX_SAFE_INTEGER };
      }
      const bucket = dueBucket(item);
      if (bucket === 'Overdue') {
        return { bucket: 0, sortValue: dueTime };
      }
      if (bucket === 'Due in 7 days') {
        return { bucket: 1, sortValue: dueTime };
      }
      return { bucket: 2, sortValue: dueTime };
    }

    function renderGroupedRows(items) {
      if (state.groupBy === 'none') {
        return items.map(renderRow);
      }

      const groups = new Map();
      items.forEach(item => {
        const key = groupKey(item);
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key).push(item);
      });

      const nodes = [];
      groups.forEach((groupItems, key) => {
        nodes.push(groupRow(key, groupItems.length));
        nodes.push(...groupItems.map(renderRow));
      });
      return nodes;
    }

    function groupKey(item) {
      if (state.groupBy === 'status') {
        return item.badge;
      }
      if (state.groupBy === 'review') {
        return reviewLabel(item.reviewStatus);
      }
      if (state.groupBy === 'owner') {
        return ownerValue(item);
      }
      if (state.groupBy === 'due') {
        return dueBucket(item);
      }
      if (state.groupBy === 'risk') {
        return item.riskCodes[0] || 'No risk code';
      }
      return 'All';
    }

    function ownerValue(item) {
      return item.reviewOwner || 'Unassigned';
    }

    function previewFreshnessReasonOptions() {
      const summaryReasons = Array.isArray(dashboard.previewFreshnessSummary)
        ? dashboard.previewFreshnessSummary.map(item => item.reason).filter(reason => reason)
        : [];
      return Array.from(new Set(summaryReasons)).sort((a, b) => a.localeCompare(b));
    }

    function previewReasonMatches(item, reason) {
      const reasonKeys = Array.isArray(item.previewFreshnessReasonKeys) ? item.previewFreshnessReasonKeys : [];
      return reasonKeys.includes(reason);
    }

    function hasActiveFilters() {
      return state.search !== ''
        || state.status !== 'all'
        || state.riskCode !== 'all'
        || state.previewReason !== 'all'
        || state.reviewStatus !== 'all'
        || state.owner !== 'all'
        || state.riskOnly !== true;
    }

    function resetDashboardFilters() {
      state.search = '';
      state.status = 'all';
      state.riskCode = 'all';
      state.previewReason = 'all';
      state.reviewStatus = 'all';
      state.owner = 'all';
      state.riskOnly = true;
      search.value = '';
      renderFilters();
      renderPreviewFreshnessSummary();
      renderOwnerSummary();
      renderRows();
    }

    function setOwnerFilter(owner) {
      state.owner = state.owner === owner ? 'all' : owner;
      ownerFilter.value = state.owner;
      renderOwnerSummary();
      renderRows();
    }

    function setPreviewReasonFilter(reason) {
      if (!reason) {
        return;
      }
      state.previewReason = state.previewReason === reason ? 'all' : reason;
      reasonFilter.value = state.previewReason;
      renderPreviewFreshnessSummary();
      renderRows();
    }

    function groupRow(label, count) {
      const tr = document.createElement('tr');
      tr.className = 'group-row';
      const td = document.createElement('td');
      td.colSpan = 12;
      td.textContent = label + ' · ' + count;
      tr.append(td);
      return tr;
    }

    function dueBucket(item) {
      if (!item.reviewDueDate) {
        return 'No due date';
      }
      const today = new Date(dashboard.today + 'T00:00:00');
      const due = new Date(item.reviewDueDate + 'T00:00:00');
      const days = Math.round((due.getTime() - today.getTime()) / 86400000);
      if (days < 0) {
        return 'Overdue';
      }
      if (days <= 7) {
        return 'Due in 7 days';
      }
      return 'Future';
    }

    function renderRow(item) {
      const tr = document.createElement('tr');
      tr.append(
        cell(selectionCell(item)),
        cell(badge(item.badge)),
        cell(text(item.relativePath, 'path')),
        cell(text(String(item.errors))),
        cell(text(String(item.warnings))),
        cell(reviewCell(item)),
        cell(ownerCell(item)),
        cell(dueDateCell(item)),
        cell(noteCell(item)),
        cell(codes(item.riskCodes)),
        cell(statusDetail(item)),
        cell(actions(item))
      );
      return tr;
    }

    function selectionCell(item) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(item.sourcePath);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          selected.add(item.sourcePath);
        } else {
          selected.delete(item.sourcePath);
        }
        renderRows();
      });
      return checkbox;
    }

    function reviewCell(item) {
      const select = document.createElement('select');
      select.className = 'review-select';
      select.replaceChildren(...dashboard.reviewStatuses.map(status => option(status.value, status.label)));
      select.value = item.reviewStatus || 'new';
      select.addEventListener('change', () => saveNote(item, select.value, item.reviewNote || '', item.reviewOwner || '', item.reviewDueDate || ''));
      return select;
    }

    function ownerCell(item) {
      const input = document.createElement('input');
      input.className = 'owner-input';
      input.type = 'text';
      input.placeholder = 'Owner';
      input.value = item.reviewOwner || '';
      input.addEventListener('change', () => saveNote(item, item.reviewStatus || 'new', item.reviewNote || '', input.value.trim(), item.reviewDueDate || ''));
      return input;
    }

    function dueDateCell(item) {
      const input = document.createElement('input');
      input.className = 'due-input';
      input.type = 'date';
      input.value = item.reviewDueDate || '';
      input.addEventListener('change', () => saveNote(item, item.reviewStatus || 'new', item.reviewNote || '', item.reviewOwner || '', input.value));
      return input;
    }

    function noteCell(item) {
      const wrapper = document.createElement('div');
      wrapper.className = 'note-field';
      const input = document.createElement('textarea');
      input.className = 'note-input';
      input.rows = 2;
      input.placeholder = 'Remediation note';
      input.value = item.reviewNote || '';
      input.addEventListener('change', () => saveNote(item, item.reviewStatus || 'new', input.value.trim(), item.reviewOwner || '', item.reviewDueDate || ''));
      const saveState = document.createElement('span');
      saveState.className = 'save-state';
      saveState.dataset.sourcePath = item.sourcePath;
      saveState.textContent = item.reviewUpdatedAt ? 'Saved' : '';
      wrapper.append(input, saveState);
      return wrapper;
    }

    function saveNote(item, status, note, owner, dueDate) {
      item.reviewStatus = status;
      item.reviewOwner = owner;
      item.reviewDueDate = dueDate;
      item.reviewNote = note;
      markSaveState(item.sourcePath, 'Saving');
      vscode.postMessage({
        command: 'saveNote',
        sourcePath: item.sourcePath,
        status,
        owner,
        dueDate,
        note
      });
    }

    function markSaveState(sourcePath, textValue) {
      document.querySelectorAll('.save-state').forEach(node => {
        if (node.dataset.sourcePath === sourcePath) {
          node.textContent = textValue;
        }
      });
    }

    function actions(item) {
      const wrapper = document.createElement('div');
      wrapper.className = 'row-actions';
      wrapper.append(
        actionButton('Source', item.sourcePath),
        actionButton('QA', item.summaryPath),
        actionButton('Preview', item.previewPath)
      );
      return wrapper;
    }

    function actionButton(label, targetPath) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => openPath(targetPath));
      return button;
    }

    function openPath(targetPath) {
      vscode.postMessage({ command: 'openPath', path: targetPath });
    }

    function cell(child) {
      const td = document.createElement('td');
      td.append(child);
      return td;
    }

    function text(value, className) {
      const span = document.createElement('span');
      span.textContent = value;
      if (className) {
        span.className = className;
      }
      return span;
    }

    function badge(status) {
      const span = document.createElement('span');
      span.className = 'badge';
      span.dataset.status = status;
      span.textContent = status;
      return span;
    }

    function codes(values) {
      const wrapper = document.createElement('div');
      wrapper.className = 'codes';
      if (!values.length) {
        wrapper.append(text('-'));
        return wrapper;
      }
      wrapper.append(...values.map(value => text(value, 'code')));
      return wrapper;
    }

    function statusDetail(item) {
      const reasons = Array.isArray(item.previewFreshnessReasons) ? item.previewFreshnessReasons : [];
      const span = text(reasons.length ? summarizeReasons(reasons) : '-', 'status-detail');
      span.title = reasons.length ? reasons.join('; ') : item.tooltip;
      return span;
    }

    function summarizeReasons(reasons) {
      const visible = reasons.slice(0, 2);
      const suffix = reasons.length > visible.length ? '; +' + (reasons.length - visible.length) + ' more' : '';
      return visible.join('; ') + suffix;
    }

    function option(value, label) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }

    function reviewLabel(value) {
      const status = dashboard.reviewStatuses.find(candidate => candidate.value === value);
      return status ? status.label : value || 'New';
    }
  </script>
</body>
</html>`;
}

function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return nonce;
}

function toScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function summarizePreviewFreshnessReasons(reasons: string[], maxReasons = 3): string {
  const visible = reasons.slice(0, maxReasons);
  const suffix = reasons.length > visible.length ? `; +${reasons.length - visible.length} more` : '';
  return `${visible.join('; ')}${suffix}`;
}

function formatPreviewFreshnessTooltip(base: string, reasons: string[]): string {
  if (reasons.length === 0) {
    return base;
  }
  return `${base} Reasons: ${summarizePreviewFreshnessReasons(reasons)}.`;
}

function formatWorkspaceStatusDetail(item: WorkspaceReportItem): string {
  if (item.previewFreshnessReasons.length === 0) {
    return '-';
  }
  return summarizePreviewFreshnessReasons(item.previewFreshnessReasons);
}

function resolvePreviewOpenPaths(result: PreviewExportResult): string[] {
  const paths = result.outputPaths?.length ? result.outputPaths : [result.outputPath];
  return Array.from(new Set(paths));
}

function scheduleAutoExport(extensionRoot: string, uri: vscode.Uri, decorations: VsdxDecorationProvider): void {
  const config = getRadarConfig();
  if (!config.autoExportOnSave || !isVsdxPath(uri.fsPath)) {
    return;
  }

  const existing = pendingAutoRuns.get(uri.fsPath);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    pendingAutoRuns.delete(uri.fsPath);
    runSafely(async () => {
      const exportResult = await exportPreviewForFile(extensionRoot, uri.fsPath);
      reportExport(exportResult);
      const qaResult = await runQaForFile(uri.fsPath, exportResult.outputPath);
      reportQa(qaResult);
      decorations.refresh(uri);
    });
  }, 1000);

  pendingAutoRuns.set(uri.fsPath, timer);
}

async function getVsdxStatus(filePath: string): Promise<VsdxStatus> {
  const config = getRadarConfig();
  const paths = resolveWorkspacePaths(filePath, config.outputDirectory);
  const previewPath = resolvePreviewPath(filePath, paths.previewDir, config.previewFormat);
  const qaPath = resolveQaPath(filePath, paths.qaDir);
  const summaryPath = resolveQaSummaryPath(qaPath);
  const cacheIndex = await loadCacheIndex(paths.cacheIndexPath);
  const previewExists = existsSync(previewPath);
  const previewFreshness = await getPreviewFreshness(cacheIndex, filePath, previewPath, config.previewFormat);
  const previewFresh = previewExists && previewFreshness.fresh;
  const previewFreshnessReasons = previewFreshness.reasons;

  if (!previewExists) {
    return {
      badge: 'M',
      color: 'charts.yellow',
      tooltip: formatPreviewFreshnessTooltip('AI-FDE VSDX Radar: missing preview cache; this is not a VSDX format or linter error.', previewFreshnessReasons),
      previewPath,
      qaPath,
      summaryPath,
      errors: 0,
      warnings: 1,
      previewFreshnessReasons
    };
  }

  if (!previewFresh) {
    return {
      badge: 'S',
      color: 'charts.yellow',
      tooltip: formatPreviewFreshnessTooltip('AI-FDE VSDX Radar: preview cache is stale.', previewFreshnessReasons),
      previewPath,
      qaPath,
      summaryPath,
      errors: 0,
      warnings: 1,
      previewFreshnessReasons
    };
  }

  if (!existsSync(qaPath)) {
    return {
      badge: 'Q',
      color: 'charts.yellow',
      tooltip: 'AI-FDE VSDX Radar: preview is fresh, QA report is missing.',
      previewPath,
      qaPath,
      summaryPath,
      errors: 0,
      warnings: 1,
      previewFreshnessReasons
    };
  }

  const [sourceStat, qaStat] = await Promise.all([
    fs.stat(filePath),
    fs.stat(qaPath)
  ]);
  if (qaStat.mtimeMs < sourceStat.mtimeMs) {
    return {
      badge: 'Q',
      color: 'charts.yellow',
      tooltip: 'AI-FDE VSDX Radar: QA report is stale.',
      previewPath,
      qaPath,
      summaryPath,
      errors: 0,
      warnings: 1,
      previewFreshnessReasons
    };
  }

  try {
    const raw = await fs.readFile(qaPath, 'utf8');
    const qa = JSON.parse(raw) as QaResult;
    const errors = qa.risks.filter(risk => risk.severity === 'error').length;
    const warnings = qa.risks.filter(risk => risk.severity === 'warning').length;
    if (errors > 0) {
      return {
        badge: 'E',
        color: 'charts.red',
        tooltip: `AI-FDE VSDX Radar: ${errors} error(s), ${warnings} warning(s).`,
        previewPath,
        qaPath,
        summaryPath,
        errors,
        warnings,
        previewFreshnessReasons
      };
    }
    if (warnings > 0) {
      return {
        badge: 'R',
        color: 'charts.yellow',
        tooltip: `AI-FDE VSDX Radar: ${warnings} risk warning(s).`,
        previewPath,
        qaPath,
        summaryPath,
        errors,
        warnings,
        previewFreshnessReasons
      };
    }
    return {
      badge: 'OK',
      color: 'charts.green',
      tooltip: 'AI-FDE VSDX Radar: preview and QA are current.',
      previewPath,
      qaPath,
      summaryPath,
      errors,
      warnings,
      previewFreshnessReasons
    };
  } catch (error) {
    return {
      badge: 'E',
      color: 'charts.red',
      tooltip: `AI-FDE VSDX Radar: failed to read QA report: ${error instanceof Error ? error.message : String(error)}`,
      previewPath,
      qaPath,
      summaryPath,
      errors: 1,
      warnings: 0,
      previewFreshnessReasons
    };
  }
}

async function withProgress<T>(title: string, task: () => Promise<T>): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      cancellable: false,
      title
    },
    task
  );
}

async function runSafely(task: () => Promise<void>): Promise<void> {
  try {
    output.show(true);
    await task();
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    output.appendLine(message);
    void vscode.window.showErrorMessage(`AI-FDE VSDX Radar failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function reportExport(result: PreviewExportResult): void {
  const label = result.cached ? 'cache hit' : result.success ? 'exported' : 'failed';
  output.appendLine(`[preview:${label}] ${path.basename(result.inputPath)} -> ${result.outputPath}`);
  if (result.bytes !== undefined) {
    output.appendLine(`  bytes=${result.bytes}`);
  }
  if (result.pageCount !== undefined) {
    output.appendLine(`  pageCount=${result.pageCount}`);
  }
  if (result.outputPaths?.length) {
    output.appendLine(`  outputPaths=${result.outputPaths.join('; ')}`);
  }
  if (result.durationMs !== undefined) {
    output.appendLine(`  durationMs=${result.durationMs}`);
  }
  if (!result.success && result.error) {
    output.appendLine(`  error=${result.error}`);
  }
}

function reportQa(result: QaResult & { qaPath: string; summaryPath: string }): void {
  const errors = result.risks.filter(risk => risk.severity === 'error').length;
  const warnings = result.risks.filter(risk => risk.severity === 'warning').length;
  output.appendLine(`[qa] pages=${result.stats.pageCount} shapes=${result.stats.shapeCount} text=${result.stats.textShapeCount} unlabeled=${result.stats.unlabeledShapeCount} oneD=${result.stats.oneDShapeCount} connects=${result.stats.connectCount} duplicateIds=${result.stats.duplicateShapeIdCount} diagonal=${result.stats.diagonalConnectorCount} crossings=${result.stats.connectorCrossingCount} dangling=${result.stats.danglingConnectorCount} overlaps=${result.stats.shapeOverlapPairCount} outOfBounds=${result.stats.outOfBoundsShapeCount} errors=${errors} warnings=${warnings}`);
  output.appendLine(`  json=${result.qaPath}`);
  output.appendLine(`  summary=${result.summaryPath}`);
}
