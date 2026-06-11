import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { PreviewFormat, WorkspacePaths } from './types';
export {
  allVisioFileGlob,
  allVisioOpenDialogExtensions,
  getVisioFormatSupport,
  isLegacyBinaryVisioPath,
  isLegacyOpaqueVisioPath,
  isLegacyXmlVisioPath,
  isLegacyVisioPath,
  isModernVisioPath,
  isSemanticVisioPath,
  isVisioPath,
  legacyXmlVisioFileGlob,
  modernVisioFileGlob,
  modernVisioOpenDialogExtensions,
  semanticVisioFileGlob,
  semanticVisioOpenDialogExtensions
} from './visioFormats';
import { isModernVisioPath } from './visioFormats';

export function isVsdxPath(filePath: string): boolean {
  return isModernVisioPath(filePath);
}

export function shortHash(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 8);
}

export function safeBaseName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath)).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

export function resolveWorkspaceRoot(filePath: string): string {
  const uri = vscode.Uri.file(filePath);
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  return folder?.uri.fsPath ?? path.dirname(filePath);
}

export function resolveWorkspacePaths(filePath: string, outputDirectory: string): WorkspacePaths {
  const workspaceRoot = resolveWorkspaceRoot(filePath);
  const outputRoot = path.isAbsolute(outputDirectory)
    ? outputDirectory
    : path.join(workspaceRoot, outputDirectory);

  return {
    workspaceRoot,
    outputRoot,
    previewDir: path.join(outputRoot, 'previews'),
    qaDir: path.join(outputRoot, 'qa'),
    cacheIndexPath: path.join(outputRoot, 'cache-index.json')
  };
}

export function resolvePreviewPath(filePath: string, previewDir: string, format: PreviewFormat): string {
  return path.join(previewDir, `${safeBaseName(filePath)}.${shortHash(filePath)}.${format}`);
}

export function resolveQaPath(filePath: string, qaDir: string): string {
  return path.join(qaDir, `${safeBaseName(filePath)}.${shortHash(filePath)}.qa.json`);
}

export function resolveQaSummaryPath(qaJsonPath: string): string {
  return qaJsonPath.replace(/\.qa\.json$/i, '.qa.md');
}
