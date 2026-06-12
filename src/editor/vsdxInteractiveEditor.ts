import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  readVsdxDiagram,
  readVsdxDiagramFromFile,
  replaceShapeInDiagram,
  writeVsdxDiagram,
  type VsdxEditorDiagram,
  type VsdxEditorShapeUpdate
} from './vsdxModel';

export const interactiveEditorViewType = 'aiFdeVsdxRadar.interactiveEditor';

export interface VsdxEditorStatus {
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

type VsdxStatusProvider = (filePath: string) => Promise<VsdxEditorStatus>;

export class VsdxInteractiveEditorProvider implements vscode.CustomEditorProvider<VsdxInteractiveDocument> {
  private readonly changeEmitter = new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<VsdxInteractiveDocument>>();
  readonly onDidChangeCustomDocument = this.changeEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel,
    private readonly statusProvider?: VsdxStatusProvider
  ) {}

  static register(
    context: vscode.ExtensionContext,
    output: vscode.OutputChannel,
    statusProvider?: VsdxStatusProvider
  ): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      interactiveEditorViewType,
      new VsdxInteractiveEditorProvider(context, output, statusProvider),
      {
        webviewOptions: {
          retainContextWhenHidden: true
        },
        supportsMultipleEditorsPerDocument: false
      }
    );
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<VsdxInteractiveDocument> {
    if (openContext.backupId) {
      const backupUri = vscode.Uri.parse(openContext.backupId);
      const bytes = Buffer.from(await vscode.workspace.fs.readFile(backupUri));
      const diagram = await readVsdxDiagram(bytes, uri.fsPath);
      return new VsdxInteractiveDocument(uri, bytes, diagram, this.statusProvider);
    }

    const { bytes, diagram } = await readVsdxDiagramFromFile(uri.fsPath);
    return new VsdxInteractiveDocument(uri, bytes, diagram, this.statusProvider);
  }

  async resolveCustomEditor(
    document: VsdxInteractiveDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true
    };
    document.addPanel(webviewPanel);
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, document);

    webviewPanel.webview.onDidReceiveMessage(async message => {
      try {
        await this.handleMessage(document, webviewPanel, message);
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        this.output.appendLine(`[interactive-editor:error] ${messageText}`);
        await vscode.window.showErrorMessage(`AI-FDE VSDX editor failed: ${messageText}`);
      }
    });
  }

  async saveCustomDocument(document: VsdxInteractiveDocument, _cancellation: vscode.CancellationToken): Promise<void> {
    await document.saveTo(document.uri);
    this.output.appendLine(`[interactive-editor:save] ${document.uri.fsPath}`);
  }

  async saveCustomDocumentAs(
    document: VsdxInteractiveDocument,
    destination: vscode.Uri,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    await document.saveTo(destination);
    this.output.appendLine(`[interactive-editor:save-as] ${destination.fsPath}`);
  }

  async revertCustomDocument(document: VsdxInteractiveDocument, _cancellation: vscode.CancellationToken): Promise<void> {
    await document.revert();
    document.broadcastState();
    this.output.appendLine(`[interactive-editor:revert] ${document.uri.fsPath}`);
  }

  async backupCustomDocument(
    document: VsdxInteractiveDocument,
    backupContext: vscode.CustomDocumentBackupContext,
    _cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    const bytes = await document.toBytes();
    await vscode.workspace.fs.writeFile(backupContext.destination, bytes);
    return {
      id: backupContext.destination.toString(),
      delete: () => {
        void fs.unlink(backupContext.destination.fsPath).catch(() => undefined);
      }
    };
  }

  private async handleMessage(
    document: VsdxInteractiveDocument,
    webviewPanel: vscode.WebviewPanel,
    message: { command?: string; update?: VsdxEditorShapeUpdate }
  ): Promise<void> {
    if (message.command === 'ready') {
      await document.postState(webviewPanel);
      return;
    }

    if (message.command === 'editShape' && message.update) {
      document.applyShapeUpdate(message.update);
      this.changeEmitter.fire({ document });
      return;
    }

    if (message.command === 'convertLegacy') {
      await vscode.commands.executeCommand('aiFdeVsdxRadar.convertToModernVisio', document.uri);
      return;
    }

    if (message.command === 'save') {
      await vscode.commands.executeCommand('workbench.action.files.save');
      return;
    }

    if (message.command === 'revealSource') {
      await vscode.commands.executeCommand('revealFileInOS', document.uri);
    }
  }

  private getHtml(webview: vscode.Webview, document: VsdxInteractiveDocument): string {
    const nonce = createNonce();
    const title = escapeHtml(path.basename(document.uri.fsPath));
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light dark;
      --panel-width: 320px;
      --splitter-width: 8px;
      --border: var(--vscode-panel-border, #3c3c3c);
      --muted: var(--vscode-descriptionForeground, #8b949e);
      --surface: var(--vscode-editor-background, #1f1f1f);
      --surface-alt: var(--vscode-sideBar-background, #252526);
      --accent: var(--vscode-focusBorder, #0078d4);
      --text: var(--vscode-editor-foreground, #d4d4d4);
      --button: var(--vscode-button-background, #0e639c);
      --button-text: var(--vscode-button-foreground, #ffffff);
    }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: var(--surface);
      color: var(--text);
      font-family: var(--vscode-font-family, Segoe UI, sans-serif);
      font-size: var(--vscode-font-size, 13px);
    }
    button, select, input, textarea {
      font: inherit;
    }
    button {
      height: 28px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--vscode-button-secondaryBackground, transparent);
      color: var(--text);
      padding: 0 9px;
      cursor: pointer;
      white-space: nowrap;
    }
    button.primary {
      background: var(--button);
      color: var(--button-text);
      border-color: transparent;
    }
    button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible {
      outline: 1px solid var(--accent);
      outline-offset: 1px;
    }
    .shell {
      height: 100%;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
    }
    .toolbar {
      position: relative;
      z-index: 2;
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-alt);
      box-sizing: border-box;
      min-width: 0;
      overflow: visible;
    }
    .toolbar select {
      min-width: 86px;
      max-width: 260px;
      height: 28px;
      background: var(--vscode-dropdown-background, var(--surface));
      color: var(--text);
      border: 1px solid var(--vscode-dropdown-border, var(--border));
      border-radius: 4px;
    }
    .toolbar .spacer {
      flex: 0 0 4px;
      min-width: 4px;
    }
    .toolbar-group {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 8px;
      flex: 0 1 auto;
      min-width: 0;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex: 0 1 auto;
      width: 52px;
      min-width: 52px;
      max-width: 52px;
      height: 28px;
      padding: 0 9px;
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
    }
    #statusText {
      display: none;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #languageSelect {
      flex: 0 1 150px;
    }
    #settingsButton,
    #togglePanel,
    #revealSource,
    #convertLegacy,
    #saveFile {
      flex: 0 0 auto;
    }
    @media (max-width: 760px) {
      .toolbar {
        flex-wrap: wrap;
        gap: 6px;
        padding: 6px 8px;
      }
      .toolbar .spacer {
        display: none;
      }
      .toolbar-group {
        flex-wrap: wrap;
        width: auto;
      }
      .status-pill {
        width: 52px;
        min-width: 52px;
        max-width: 52px;
      }
      #languageSelect {
        flex: 0 1 150px;
      }
    }
    .status-badge {
      min-width: 22px;
      height: 18px;
      display: inline-grid;
      place-items: center;
      border-radius: 3px;
      background: var(--vscode-badge-background, #4d4d4d);
      color: var(--vscode-badge-foreground, #ffffff);
      font-size: 11px;
      font-weight: 600;
    }
    .status-badge[data-badge="E"] {
      background: var(--vscode-errorForeground, #f85149);
      color: #ffffff;
    }
    .status-badge[data-badge="M"],
    .status-badge[data-badge="Q"],
    .status-badge[data-badge="R"],
    .status-badge[data-badge="S"] {
      background: var(--vscode-editorWarning-foreground, #d29922);
      color: #111111;
    }
    .status-badge[data-badge="OK"] {
      background: var(--vscode-testing-iconPassed, #3fb950);
      color: #111111;
    }
    .zoom-readout {
      min-width: 54px;
      text-align: center;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    .workspace {
      position: relative;
      z-index: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) var(--splitter-width) var(--panel-width);
      min-height: 0;
      min-width: 0;
    }
    .workspace.panel-collapsed {
      grid-template-columns: minmax(0, 1fr) 0 0;
    }
    .canvas-wrap {
      position: relative;
      min-width: 0;
      min-height: 0;
      overflow: auto;
      background:
        linear-gradient(45deg, rgba(127,127,127,0.09) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(127,127,127,0.09) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(127,127,127,0.09) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(127,127,127,0.09) 75%);
      background-size: 22px 22px;
      background-position: 0 0, 0 11px, 11px -11px, -11px 0;
    }
    .page-stage {
      padding: 28px 40px 28px 28px;
      min-width: min-content;
      min-height: min-content;
    }
    .splitter {
      position: relative;
      min-width: var(--splitter-width);
      background: var(--surface);
      border-left: 1px solid var(--border);
      border-right: 1px solid var(--border);
      cursor: col-resize;
      box-sizing: border-box;
      z-index: 1;
      touch-action: none;
    }
    .splitter::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 12px;
      bottom: 12px;
      width: 2px;
      transform: translateX(-50%);
      background: var(--muted);
      opacity: 0.45;
    }
    .workspace.panel-collapsed .splitter {
      min-width: 0;
      border: 0;
      cursor: default;
    }
    .workspace.panel-collapsed .splitter::after {
      display: none;
    }
    .workspace.resizing-panel .canvas-wrap,
    .workspace.resizing-panel .inspector {
      pointer-events: none;
      user-select: none;
    }
    svg.diagram {
      display: block;
      background: #ffffff;
      color: #111827;
      box-shadow: 0 1px 6px rgba(0,0,0,0.28);
      user-select: none;
      touch-action: none;
    }
    .shape-node {
      cursor: grab;
    }
    .shape-node[data-readonly="true"] {
      cursor: default;
      opacity: 0.78;
    }
    .connector-node {
      cursor: move;
    }
    .connector-arrow {
      fill: context-stroke;
      stroke: none;
    }
    .shape-outline {
      vector-effect: non-scaling-stroke;
    }
    .selected .shape-outline,
    .selected.connector-node {
      stroke: var(--accent);
      stroke-width: 0.035;
    }
    .handle {
      fill: var(--accent);
      stroke: #ffffff;
      stroke-width: 0.015;
      cursor: pointer;
      vector-effect: non-scaling-stroke;
    }
    .shape-resize-handle {
      cursor: nesw-resize;
    }
    .shape-label {
      fill: #111827;
      pointer-events: none;
      white-space: pre;
      dominant-baseline: middle;
      text-anchor: middle;
      font-family: "Segoe UI", sans-serif;
    }
    .inspector {
      background: var(--surface-alt);
      padding: 12px;
      overflow: auto;
      min-width: 0;
      box-sizing: border-box;
    }
    .inspector h2 {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 600;
    }
    .field {
      display: grid;
      gap: 5px;
      margin: 0 0 10px;
    }
    .field label {
      color: var(--muted);
      font-size: 12px;
    }
    .field input, .field textarea, .field select {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--vscode-input-border, var(--border));
      border-radius: 4px;
      background: var(--vscode-input-background, var(--surface));
      color: var(--vscode-input-foreground, var(--text));
      padding: 5px 7px;
    }
    .field textarea {
      min-height: 82px;
      resize: vertical;
      line-height: 1.35;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .status {
      margin-top: 12px;
      color: var(--muted);
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .status-card {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px;
      margin: 0 0 12px;
      background: color-mix(in srgb, var(--surface) 80%, transparent);
    }
    .status-card strong {
      display: block;
      margin-bottom: 6px;
      color: var(--text);
    }
    .status-card code {
      display: block;
      margin-top: 6px;
      color: var(--muted);
      font-family: var(--vscode-editor-font-family, Consolas, monospace);
      font-size: 11px;
      overflow-wrap: anywhere;
    }
    .settings-panel {
      display: grid;
      gap: 10px;
    }
    .settings-panel .hint {
      color: var(--muted);
      line-height: 1.35;
    }
    .empty {
      height: 100%;
      display: grid;
      place-items: center;
      color: var(--muted);
      text-align: center;
      padding: 20px;
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="toolbar">
      <div class="toolbar-group">
        <select id="pageSelect" aria-label="Page"></select>
        <button id="zoomOut" title="Zoom out">-</button>
        <span id="zoomReadout" class="zoom-readout">100%</span>
        <button id="zoomIn" title="Zoom in">+</button>
        <button id="zoomFit" title="Fit page" data-i18n="fit">Fit</button>
        <button id="zoomOne" title="Actual size">100%</button>
      </div>
      <div id="statusPill" class="status-pill" title="">
        <span id="statusBadge" class="status-badge" data-badge="-">-</span>
        <span id="statusText">Status</span>
      </div>
      <span class="spacer"></span>
      <div class="toolbar-group">
        <select id="languageSelect" aria-label="Language">
          <option value="zh-CN">简体中文</option>
          <option value="en">English</option>
        </select>
        <button id="settingsButton" title="Settings" data-i18n="settings">Settings</button>
        <button id="togglePanel" title="Toggle inspector" data-i18n="collapsePanel">Hide Panel</button>
        <button id="revealSource" title="Reveal source file" data-i18n="source">Source</button>
        <button id="convertLegacy" class="primary" title="Convert legacy Visio file" data-i18n="convertLegacy">Convert</button>
        <button id="saveFile" class="primary" title="Save VSDX" data-i18n="save">Save</button>
      </div>
    </div>
    <div id="workspace" class="workspace">
      <div id="canvasWrap" class="canvas-wrap">
        <div id="pageStage" class="page-stage"></div>
      </div>
      <div id="splitter" class="splitter" role="separator" aria-orientation="vertical" aria-label="Resize inspector"></div>
      <aside id="inspector" class="inspector"></aside>
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const svgNS = 'http://www.w3.org/2000/svg';
    let diagram = null;
    let pageIndex = 0;
    let zoom = 1;
    let selectedId = '';
    let drag = null;
    let dirty = false;
    let currentStatus = null;
    let language = 'zh-CN';
    let panelWidth = 320;
    let panelCollapsed = false;
    let inspectorMode = 'selection';
    let resizingPanel = false;

    const pageSelect = document.getElementById('pageSelect');
    const zoomReadout = document.getElementById('zoomReadout');
    const pageStage = document.getElementById('pageStage');
    const canvasWrap = document.getElementById('canvasWrap');
    const inspector = document.getElementById('inspector');
    const workspace = document.getElementById('workspace');
    const splitter = document.getElementById('splitter');
    const languageSelect = document.getElementById('languageSelect');
    const statusPill = document.getElementById('statusPill');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');

    const i18n = {
      'zh-CN': {
        fit: '适配',
        settings: '设置',
        collapsePanel: '隐藏侧栏',
        showPanel: '显示侧栏',
        source: '源文件',
        convertLegacy: '转换',
        convertLegacyAction: '转换为现代 Visio 包',
        convertLegacyHint: '此旧格式不能直接进行语义编辑。转换后会自动打开生成的 .vsdx/.vssx/.vstx 文件。',
        save: '保存',
        page: '页面',
        noSelection: '未选择',
        shapesOnPage: (count, pageName) => pageName + ' 上有 ' + count + ' 个对象。',
        text: '文字',
        unsaved: '有未保存修改',
        saved: '当前已保存',
        readOnly: '只读对象',
        settingsTitle: '设置',
        language: '界面语言',
        panelWidth: '侧栏宽度',
        panelHint: '拖拽画布和侧栏之间的细分隔条即可调整宽度。分隔条只在工作区内，不会遮挡顶部按钮。',
        statusTitle: '文件状态',
        statusUnknown: '未读取状态',
        statusM: '缺少预览缓存',
        statusS: '预览缓存已过期',
        statusQ: 'QA 报告缺失或过期',
        statusE: 'QA 存在错误',
        statusR: 'QA 有风险提示',
        statusOK: '预览和 QA 当前可用',
        statusCounts: (errors, warnings) => '错误 ' + errors + '，警告 ' + warnings,
        statusNoteM: 'M 表示缺少预览缓存，不等于 VSDX 内容格式错误。运行导出预览或 QA 后状态会更新。',
        statusNoteGeneric: '这里显示的是插件的预览/QA 状态，不是 VS Code 内置格式校验。只有 E 才表示 QA 错误；M 只是缺少预览缓存。',
        previewPath: '预览',
        qaPath: 'QA',
        summaryPath: '摘要',
        editPrompt: '文字',
        empty: '没有找到 Visio 页面。',
        zoomOut: '缩小',
        zoomIn: '放大',
        actualSize: '实际大小',
        resizeInspector: '拖拽调整侧栏宽度'
      },
      en: {
        fit: 'Fit',
        settings: 'Settings',
        collapsePanel: 'Hide Panel',
        showPanel: 'Show Panel',
        source: 'Source',
        convertLegacy: 'Convert',
        convertLegacyAction: 'Convert to modern Visio package',
        convertLegacyHint: 'This legacy format cannot be semantically edited in place. After conversion the generated .vsdx/.vssx/.vstx file opens automatically.',
        save: 'Save',
        page: 'Page',
        noSelection: 'No selection',
        shapesOnPage: (count, pageName) => count + ' shape(s) on ' + pageName + '.',
        text: 'Text',
        unsaved: 'Unsaved edits',
        saved: 'Saved state',
        readOnly: 'Read-only shape',
        settingsTitle: 'Settings',
        language: 'UI language',
        panelWidth: 'Panel width',
        panelHint: 'Drag the narrow divider between the canvas and inspector to resize. The divider stays inside the work area and does not cover toolbar buttons.',
        statusTitle: 'File status',
        statusUnknown: 'Status not loaded',
        statusM: 'Missing preview cache',
        statusS: 'Preview cache is stale',
        statusQ: 'QA report missing or stale',
        statusE: 'QA has errors',
        statusR: 'QA has warnings',
        statusOK: 'Preview and QA are current',
        statusCounts: (errors, warnings) => 'Errors ' + errors + ', warnings ' + warnings,
        statusNoteM: 'M means the preview cache is missing. It does not necessarily mean the VSDX file format is invalid.',
        statusNoteGeneric: 'This status comes from the extension preview/QA artifacts, not VS Code built-in file-format validation. Only E means QA errors; M only means the preview cache is missing.',
        previewPath: 'Preview',
        qaPath: 'QA',
        summaryPath: 'Summary',
        editPrompt: 'Text',
        empty: 'No Visio pages found.',
        zoomOut: 'Zoom out',
        zoomIn: 'Zoom in',
        actualSize: 'Actual size',
        resizeInspector: 'Resize inspector'
      }
    };

    window.addEventListener('message', event => {
      if (event.data.command === 'load') {
        diagram = event.data.diagram;
        currentStatus = event.data.status || null;
        dirty = false;
        const saved = vscode.getState() || {};
        pageIndex = Math.min(saved.pageIndex || 0, Math.max(0, (diagram.pages || []).length - 1));
        zoom = saved.zoom || 1;
        selectedId = saved.selectedId || '';
        language = saved.language || language;
        panelWidth = clampPanelWidth(saved.panelWidth || panelWidth);
        panelCollapsed = Boolean(saved.panelCollapsed);
        inspectorMode = saved.inspectorMode || 'selection';
        languageSelect.value = language;
        applyPanelLayout();
        applyLanguage();
        render();
      }
      if (event.data.command === 'saved') {
        currentStatus = event.data.status || currentStatus;
        dirty = false;
        renderStatusPill();
        renderInspector();
      }
    });

    document.getElementById('zoomOut').addEventListener('click', () => setZoom(zoom / 1.2));
    document.getElementById('zoomIn').addEventListener('click', () => setZoom(zoom * 1.2));
    document.getElementById('zoomOne').addEventListener('click', () => setZoom(1));
    document.getElementById('zoomFit').addEventListener('click', fitPage);
    document.getElementById('saveFile').addEventListener('click', () => vscode.postMessage({ command: 'save' }));
    document.getElementById('convertLegacy').addEventListener('click', () => vscode.postMessage({ command: 'convertLegacy' }));
    document.getElementById('revealSource').addEventListener('click', () => vscode.postMessage({ command: 'revealSource' }));
    document.getElementById('settingsButton').addEventListener('click', () => {
      inspectorMode = inspectorMode === 'settings' ? 'selection' : 'settings';
      if (panelCollapsed) {
        panelCollapsed = false;
        applyPanelLayout();
      }
      renderInspector();
      rememberState();
    });
    document.getElementById('togglePanel').addEventListener('click', () => {
      panelCollapsed = !panelCollapsed;
      applyPanelLayout();
      fitPage();
      renderInspector();
      rememberState();
    });
    languageSelect.addEventListener('change', () => {
      language = languageSelect.value;
      applyLanguage();
      renderInspector();
      rememberState();
    });
    splitter.addEventListener('pointerdown', event => {
      if (panelCollapsed) {
        return;
      }
      resizingPanel = true;
      workspace.classList.add('resizing-panel');
      splitter.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    splitter.addEventListener('pointermove', event => {
      updatePanelResize(event);
    });
    splitter.addEventListener('pointerup', event => {
      finishPanelResize(event);
    });
    splitter.addEventListener('lostpointercapture', () => {
      finishPanelResize();
    });
    pageSelect.addEventListener('change', () => {
      pageIndex = Number(pageSelect.value);
      selectedId = '';
      rememberState();
      render();
    });

    window.addEventListener('pointermove', event => {
      if (resizingPanel) {
        updatePanelResize(event);
        return;
      }
      if (!drag || !diagram) {
        return;
      }
      const page = currentPage();
      const point = pointerToPage(event);
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      const shape = drag.shape;
      if (drag.mode === 'shape') {
        shape.x = round4(drag.original.x + dx);
        shape.y = round4(drag.original.y + dy);
      } else if (drag.mode === 'resize-shape') {
        const anchorX = numberOr(drag.original.x, 0);
        const anchorY = numberOr(drag.original.y, 0);
        shape.width = round4(clamp(point.x - anchorX, 0.05, page.width - anchorX));
        shape.height = round4(clamp(point.y - anchorY, 0.05, page.height - anchorY));
      } else if (drag.mode === 'connector') {
        shape.beginX = round4(drag.original.beginX + dx);
        shape.beginY = round4(drag.original.beginY + dy);
        shape.endX = round4(drag.original.endX + dx);
        shape.endY = round4(drag.original.endY + dy);
        invalidateConnectorGeometry(shape);
      } else if (drag.mode === 'begin') {
        shape.beginX = clamp(point.x, 0, page.width);
        shape.beginY = clamp(point.y, 0, page.height);
        invalidateConnectorGeometry(shape);
      } else if (drag.mode === 'end') {
        shape.endX = clamp(point.x, 0, page.width);
        shape.endY = clamp(point.y, 0, page.height);
        invalidateConnectorGeometry(shape);
      }
      dirty = true;
      renderCanvas();
      renderInspector();
    });

    window.addEventListener('pointerup', () => {
      if (resizingPanel) {
        finishPanelResize();
      }
      if (!drag) {
        return;
      }
      postShapeUpdate(drag.shape);
      drag = null;
    });

    window.addEventListener('resize', () => {
      panelWidth = clampPanelWidth(panelWidth);
      applyPanelLayout();
      if (diagram) {
        renderCanvas();
      }
      rememberState();
    });

    function render() {
      if (!diagram || !diagram.pages || diagram.pages.length === 0) {
        pageStage.innerHTML = '<div class="empty">' + t('empty') + '</div>';
        inspector.replaceChildren();
        return;
      }
      pageSelect.replaceChildren(...diagram.pages.map((page, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = page.name;
        return option;
      }));
      pageSelect.value = String(pageIndex);
      zoomReadout.textContent = Math.round(zoom * 100) + '%';
      applyFormatActions();
      renderStatusPill();
      renderCanvas();
      renderInspector();
      rememberState();
    }

    function renderCanvas() {
      const page = currentPage();
      pageStage.replaceChildren();
      const svg = document.createElementNS(svgNS, 'svg');
      svg.classList.add('diagram');
      svg.setAttribute('id', 'diagramSvg');
      svg.setAttribute('viewBox', '0 0 ' + page.width + ' ' + page.height);
      svg.style.width = Math.max(80, page.width * 96 * zoom) + 'px';
      svg.style.height = Math.max(80, page.height * 96 * zoom) + 'px';
      svg.append(svgDefinitions());
      svg.addEventListener('pointerdown', event => {
        if (event.target === svg) {
          selectedId = '';
          renderCanvas();
          renderInspector();
        }
      });

      const background = document.createElementNS(svgNS, 'rect');
      background.setAttribute('x', '0');
      background.setAttribute('y', '0');
      background.setAttribute('width', String(page.width));
      background.setAttribute('height', String(page.height));
      background.setAttribute('fill', '#ffffff');
      svg.append(background);

      for (const shape of page.shapes.filter(item => item.kind === 'connector')) {
        svg.append(renderConnector(page, shape));
      }
      for (const shape of page.shapes.filter(item => item.kind === 'shape')) {
        svg.append(renderShape(page, shape));
      }

      pageStage.append(svg);
      zoomReadout.textContent = Math.round(zoom * 100) + '%';
    }

    function svgDefinitions() {
      const defs = document.createElementNS(svgNS, 'defs');
      const markerEnd = document.createElementNS(svgNS, 'marker');
      markerEnd.id = 'arrow-end';
      markerEnd.setAttribute('viewBox', '0 0 10 10');
      markerEnd.setAttribute('refX', '9');
      markerEnd.setAttribute('refY', '5');
      markerEnd.setAttribute('markerWidth', '7');
      markerEnd.setAttribute('markerHeight', '7');
      markerEnd.setAttribute('orient', 'auto-start-reverse');
      markerEnd.setAttribute('markerUnits', 'strokeWidth');
      const endPath = document.createElementNS(svgNS, 'path');
      endPath.classList.add('connector-arrow');
      endPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      markerEnd.append(endPath);

      const markerStart = markerEnd.cloneNode(true);
      markerStart.id = 'arrow-start';
      defs.append(markerStart, markerEnd);
      return defs;
    }

    function renderShape(page, shape) {
      const group = document.createElementNS(svgNS, 'g');
      group.classList.add('shape-node');
      if (shape.id === selectedId) {
        group.classList.add('selected');
      }
      group.dataset.id = shape.id;
      group.dataset.readonly = String(!shape.editable);
      const x = numberOr(shape.x, 0);
      const y = page.height - numberOr(shape.y, 0) - numberOr(shape.height, 0.6);
      const width = numberOr(shape.width, 1);
      const height = numberOr(shape.height, 0.6);
      const angle = numberOr(shape.angle, 0);
      if (Math.abs(angle) > 0.0001) {
        const degrees = -angle * 180 / Math.PI;
        group.setAttribute('transform', 'rotate(' + degrees + ' ' + (x + width / 2) + ' ' + (y + height / 2) + ')');
      }
      if (shape.imageDataUri) {
        const image = document.createElementNS(svgNS, 'image');
        image.setAttribute('x', String(x));
        image.setAttribute('y', String(y));
        image.setAttribute('width', String(width));
        image.setAttribute('height', String(height));
        image.setAttribute('href', shape.imageDataUri);
        image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        group.append(image);
      }
      if (shape.geometryPath) {
        const path = document.createElementNS(svgNS, 'path');
        path.classList.add('shape-outline');
        path.setAttribute('d', shape.geometryPath);
        path.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
        path.setAttribute('fill', shape.imageDataUri ? 'none' : safeColor(shape.fill, '#ffffff'));
        path.setAttribute('stroke', safeColor(shape.line, '#586069'));
        path.setAttribute('stroke-width', String(Math.max(0.012, numberOr(shape.strokeWidth, 0.02))));
        group.append(path);
      } else {
        const rect = document.createElementNS(svgNS, 'rect');
        rect.classList.add('shape-outline');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(width));
        rect.setAttribute('height', String(height));
        rect.setAttribute('rx', String(Math.min(0.08, height / 6)));
        rect.setAttribute('fill', shape.imageDataUri ? 'none' : safeColor(shape.fill, '#ffffff'));
        rect.setAttribute('stroke', safeColor(shape.line, '#586069'));
        rect.setAttribute('stroke-width', String(Math.max(0.012, numberOr(shape.strokeWidth, 0.02))));
        group.append(rect);
      }

      if (shape.text) {
        const text = document.createElementNS(svgNS, 'text');
        text.classList.add('shape-label');
        const textBox = resolveTextBox(page, shape, x, y, width, height);
        text.setAttribute('x', String(textBox.x + textBox.width / 2));
        text.setAttribute('y', String(textBox.y + textBox.height / 2));
        if (Math.abs(textBox.angle) > 0.0001) {
          const degrees = -textBox.angle * 180 / Math.PI;
          text.setAttribute('transform', 'rotate(' + degrees + ' ' + (textBox.x + textBox.width / 2) + ' ' + (textBox.y + textBox.height / 2) + ')');
        }
        text.setAttribute('font-size', String(Math.min(0.16, Math.max(0.08, textBox.height / 3.2))));
        const lines = String(shape.text).replace(/\\r/g, '').split('\\n').filter(line => line.length > 0);
        const lineHeight = Math.min(0.18, Math.max(0.09, textBox.height / Math.max(2, lines.length + 1)));
        const startOffset = -((lines.length - 1) * lineHeight) / 2;
        lines.slice(0, 5).forEach((line, index) => {
          const tspan = document.createElementNS(svgNS, 'tspan');
          tspan.setAttribute('x', String(textBox.x + textBox.width / 2));
          tspan.setAttribute('dy', index === 0 ? String(startOffset) : String(lineHeight));
          tspan.textContent = line;
          text.append(tspan);
        });
        group.append(text);
      }

      if (shape.editable && Math.abs(angle) < 0.0001) {
        const handle = document.createElementNS(svgNS, 'rect');
        handle.classList.add('handle', 'shape-resize-handle');
        handle.setAttribute('x', String(x + width - 0.06));
        handle.setAttribute('y', String(y - 0.06));
        handle.setAttribute('width', '0.12');
        handle.setAttribute('height', '0.12');
        handle.setAttribute('rx', '0.02');
        handle.addEventListener('pointerdown', event => {
          event.stopPropagation();
          selectShape(shape.id);
          startDrag(event, shape, 'resize-shape');
        });
        group.append(handle);
      }

      group.addEventListener('pointerdown', event => {
        selectShape(shape.id);
        if (shape.editable) {
          startDrag(event, shape, 'shape');
        }
      });
      group.addEventListener('dblclick', event => {
        event.preventDefault();
        editText(shape);
      });
      return group;
    }

    function resolveTextBox(page, shape, shapeX, shapeY, shapeWidth, shapeHeight) {
      const box = shape.textBox || {};
      const width = Math.max(0.05, numberOr(box.width, shapeWidth));
      const height = Math.max(0.05, numberOr(box.height, shapeHeight));
      const localX = numberOr(box.x, 0);
      const localY = numberOr(box.y, 0);
      return {
        x: shapeX + localX,
        y: shapeY + shapeHeight - localY - height,
        width,
        height,
        angle: numberOr(box.angle, 0)
      };
    }

    function renderConnector(page, shape) {
      const group = document.createElementNS(svgNS, 'g');
      group.classList.add('connector-node');
      if (shape.id === selectedId) {
        group.classList.add('selected');
      }
      group.dataset.id = shape.id;
      const x1 = numberOr(shape.beginX, 0);
      const y1 = page.height - numberOr(shape.beginY, 0);
      const x2 = numberOr(shape.endX, 0);
      const y2 = page.height - numberOr(shape.endY, 0);
      let connectorBody = null;
      if (shape.geometryPath && shape.x !== undefined && shape.y !== undefined && shape.width !== undefined && shape.height !== undefined) {
        const x = numberOr(shape.x, 0);
        const y = page.height - numberOr(shape.y, 0) - numberOr(shape.height, 0.6);
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', shape.geometryPath);
        path.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', safeColor(shape.line, '#3b82f6'));
        path.setAttribute('stroke-width', String(Math.max(0.018, numberOr(shape.strokeWidth, 0.025))));
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        applyConnectorStyle(path, shape);
        group.append(path);
        connectorBody = path;
      } else {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));
        line.setAttribute('stroke', safeColor(shape.line, '#3b82f6'));
        line.setAttribute('stroke-width', String(Math.max(0.018, numberOr(shape.strokeWidth, 0.025))));
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        applyConnectorStyle(line, shape);
        group.append(line);
        connectorBody = line;
      }
      if (shape.editable) {
        group.append(connectorHandle(page, shape, 'begin', x1, y1));
        group.append(connectorHandle(page, shape, 'end', x2, y2));
      }
      group.addEventListener('pointerdown', event => {
        selectShape(shape.id);
        if (shape.editable && event.target === connectorBody) {
          startDrag(event, shape, 'connector');
        }
      });
      return group;
    }

    function applyConnectorStyle(node, shape) {
      const dashArray = connectorDashArray(shape);
      if (dashArray) {
        node.setAttribute('stroke-dasharray', dashArray);
      }
      if (numberOr(shape.beginArrow, 0) > 0) {
        node.setAttribute('marker-start', 'url(#arrow-start)');
      }
      if (numberOr(shape.endArrow, 0) > 0) {
        node.setAttribute('marker-end', 'url(#arrow-end)');
      }
    }

    function connectorDashArray(shape) {
      const pattern = Math.round(numberOr(shape.linePattern, 1));
      const stroke = Math.max(0.018, numberOr(shape.strokeWidth, 0.025));
      if (pattern === 2) {
        return String(round4(stroke * 4)) + ' ' + String(round4(stroke * 2.5));
      }
      if (pattern === 3) {
        return String(round4(stroke)) + ' ' + String(round4(stroke * 2.2));
      }
      if (pattern >= 4) {
        return String(round4(stroke * 4)) + ' ' + String(round4(stroke * 2)) + ' ' + String(round4(stroke)) + ' ' + String(round4(stroke * 2));
      }
      return '';
    }

    function connectorHandle(page, shape, mode, x, y) {
      const handle = document.createElementNS(svgNS, 'circle');
      handle.classList.add('handle');
      handle.setAttribute('cx', String(x));
      handle.setAttribute('cy', String(y));
      handle.setAttribute('r', '0.06');
      handle.addEventListener('pointerdown', event => {
        event.stopPropagation();
        selectShape(shape.id);
        startDrag(event, shape, mode);
      });
      return handle;
    }

    function renderInspector() {
      inspector.replaceChildren();
      if (panelCollapsed) {
        return;
      }
      if (inspectorMode === 'settings') {
        renderSettings();
        return;
      }
      const page = currentPage();
      const shape = currentShape();
      inspector.append(statusCard());
      const title = document.createElement('h2');
      title.textContent = shape ? shape.name + ' #' + shape.id : t('noSelection');
      inspector.append(title);
      if (!shape) {
        const status = document.createElement('div');
        status.className = 'status';
        status.textContent = t('shapesOnPage')(page.shapes.length, page.name);
        inspector.append(status);
        return;
      }
      if (!shape.editable) {
        const status = document.createElement('div');
        status.className = 'status';
        status.textContent = shape.reason || t('readOnly');
        inspector.append(status);
        return;
      }
      if (shape.kind === 'shape') {
        inspector.append(textField(shape), numberGrid([
          ['X', 'x'], ['Y', 'y'], ['W', 'width'], ['H', 'height']
        ], shape));
      } else {
        inspector.append(textField(shape), numberGrid([
          ['Begin X', 'beginX'], ['Begin Y', 'beginY'], ['End X', 'endX'], ['End Y', 'endY']
        ], shape));
      }
      const status = document.createElement('div');
      status.className = 'status';
      status.textContent = dirty ? t('unsaved') : t('saved');
      inspector.append(status);
    }

    function renderSettings() {
      const wrapper = document.createElement('div');
      wrapper.className = 'settings-panel';
      const title = document.createElement('h2');
      title.textContent = t('settingsTitle');
      wrapper.append(title, statusCard());

      const langField = document.createElement('div');
      langField.className = 'field';
      const langLabel = document.createElement('label');
      langLabel.textContent = t('language');
      const langSelect = document.createElement('select');
      langSelect.innerHTML = '<option value="zh-CN">简体中文</option><option value="en">English</option>';
      langSelect.value = language;
      langSelect.addEventListener('change', () => {
        language = langSelect.value;
        languageSelect.value = language;
        applyLanguage();
        renderInspector();
        rememberState();
      });
      langField.append(langLabel, langSelect);

      const widthField = document.createElement('div');
      widthField.className = 'field';
      const widthLabel = document.createElement('label');
      widthLabel.textContent = t('panelWidth');
      const widthInput = document.createElement('input');
      widthInput.type = 'number';
      widthInput.min = '220';
      widthInput.max = '560';
      widthInput.step = '10';
      widthInput.value = String(Math.round(panelWidth));
      widthInput.addEventListener('change', () => {
        panelWidth = clampPanelWidth(Number(widthInput.value));
        panelCollapsed = false;
        applyPanelLayout();
        rememberState();
      });
      widthField.append(widthLabel, widthInput);

      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = t('panelHint');
      wrapper.append(langField, widthField, hint);
      inspector.append(wrapper);
    }

    function statusCard() {
      const card = document.createElement('div');
      card.className = 'status-card';
      const title = document.createElement('strong');
      title.textContent = t('statusTitle') + ': ' + statusLabel(currentStatus);
      const counts = document.createElement('div');
      counts.textContent = currentStatus
        ? t('statusCounts')(currentStatus.errors || 0, currentStatus.warnings || 0)
        : t('statusUnknown');
      card.append(title, counts);
      if (currentStatus?.badge === 'M') {
        const note = document.createElement('div');
        note.className = 'status';
        note.textContent = t('statusNoteM');
        card.append(note);
      } else {
        const note = document.createElement('div');
        note.className = 'status';
        note.textContent = t('statusNoteGeneric');
        card.append(note);
      }
      if (currentStatus?.tooltip) {
        const tooltip = document.createElement('div');
        tooltip.className = 'status';
        tooltip.textContent = currentStatus.tooltip;
        card.append(tooltip);
      }
      if (currentStatus?.previewPath) {
        const preview = document.createElement('code');
        preview.textContent = t('previewPath') + ': ' + currentStatus.previewPath;
        card.append(preview);
      }
      if (currentStatus?.qaPath) {
        const qa = document.createElement('code');
        qa.textContent = t('qaPath') + ': ' + currentStatus.qaPath;
        card.append(qa);
      }
      if (isLegacyConvertRequired()) {
        const hint = document.createElement('div');
        hint.className = 'status';
        hint.textContent = t('convertLegacyHint');
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'primary';
        action.textContent = t('convertLegacyAction');
        action.addEventListener('click', () => vscode.postMessage({ command: 'convertLegacy' }));
        card.append(hint, action);
      }
      return card;
    }

    function textField(shape) {
      const field = document.createElement('div');
      field.className = 'field';
      const label = document.createElement('label');
      label.textContent = t('text');
      const textarea = document.createElement('textarea');
      textarea.value = shape.text || '';
      textarea.addEventListener('change', () => {
        shape.text = textarea.value;
        dirty = true;
        postShapeUpdate(shape);
        renderCanvas();
        renderInspector();
      });
      field.append(label, textarea);
      return field;
    }

    function numberGrid(items, shape) {
      const wrapper = document.createElement('div');
      wrapper.className = 'grid';
      items.forEach(([labelText, key]) => {
        const field = document.createElement('div');
        field.className = 'field';
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.05';
        input.value = String(numberOr(shape[key], 0));
        input.addEventListener('change', () => {
          shape[key] = round4(Number(input.value));
          dirty = true;
          postShapeUpdate(shape);
          renderCanvas();
          renderInspector();
        });
        field.append(label, input);
        wrapper.append(field);
      });
      return wrapper;
    }

    function startDrag(event, shape, mode) {
      event.preventDefault();
      event.stopPropagation();
      const start = pointerToPage(event);
      drag = {
        mode,
        shape,
        start,
        original: { ...shape }
      };
    }

    function pointerToPage(event) {
      const svg = document.getElementById('diagramSvg');
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const transformed = point.matrixTransform(svg.getScreenCTM().inverse());
      const page = currentPage();
      return {
        x: clamp(transformed.x, 0, page.width),
        y: clamp(page.height - transformed.y, 0, page.height)
      };
    }

    function editText(shape) {
      if (!shape.editable) {
        return;
      }
      const next = window.prompt(t('editPrompt'), shape.text || '');
      if (next === null) {
        return;
      }
      shape.text = next;
      dirty = true;
      postShapeUpdate(shape);
      renderCanvas();
      renderInspector();
    }

    function postShapeUpdate(shape) {
      vscode.postMessage({
        command: 'editShape',
        update: {
          pageEntry: currentPage().entry,
          shape
        }
      });
    }

    function invalidateConnectorGeometry(shape) {
      if (shape.kind === 'connector') {
        shape.geometryPath = '';
      }
    }

    function selectShape(id) {
      selectedId = id;
      rememberState();
      renderInspector();
    }

    function currentPage() {
      return diagram.pages[pageIndex];
    }

    function currentShape() {
      const page = currentPage();
      return page.shapes.find(shape => shape.id === selectedId);
    }

    function setZoom(value) {
      zoom = clamp(value, 0.15, 4);
      renderCanvas();
      rememberState();
    }

    function fitPage() {
      const page = currentPage();
      const availableW = Math.max(120, canvasWrap.clientWidth - 70);
      const availableH = Math.max(120, canvasWrap.clientHeight - 70);
      zoom = clamp(Math.min(availableW / (page.width * 96), availableH / (page.height * 96)), 0.15, 4);
      renderCanvas();
      rememberState();
    }

    function rememberState() {
      vscode.setState({ pageIndex, zoom, selectedId, language, panelWidth, panelCollapsed, inspectorMode });
    }

    function applyPanelLayout() {
      panelWidth = clampPanelWidth(panelWidth);
      document.documentElement.style.setProperty('--panel-width', Math.round(panelWidth) + 'px');
      workspace.classList.toggle('panel-collapsed', panelCollapsed);
      document.getElementById('togglePanel').textContent = panelCollapsed ? t('showPanel') : t('collapsePanel');
      splitter.setAttribute('aria-label', t('resizeInspector'));
      splitter.setAttribute('aria-valuemin', '240');
      splitter.setAttribute('aria-valuemax', String(panelWidthMax()));
      splitter.setAttribute('aria-valuenow', String(Math.round(panelWidth)));
    }

    function applyLanguage() {
      document.documentElement.lang = language === 'zh-CN' ? 'zh-CN' : 'en';
      document.querySelectorAll('[data-i18n]').forEach(node => {
        const key = node.dataset.i18n;
        if (key && typeof t(key) === 'string') {
          node.textContent = t(key);
        }
      });
      pageSelect.setAttribute('aria-label', t('page'));
      document.getElementById('zoomOut').title = t('zoomOut');
      document.getElementById('zoomIn').title = t('zoomIn');
      document.getElementById('zoomFit').title = t('fit');
      document.getElementById('zoomOne').title = t('actualSize');
      document.getElementById('settingsButton').title = t('settings');
      document.getElementById('togglePanel').title = panelCollapsed ? t('showPanel') : t('collapsePanel');
      document.getElementById('revealSource').title = t('source');
      document.getElementById('convertLegacy').title = t('convertLegacyAction');
      document.getElementById('saveFile').title = t('save');
      applyFormatActions();
      applyPanelLayout();
      renderStatusPill();
    }

    function applyFormatActions() {
      const convertRequired = isLegacyConvertRequired();
      document.getElementById('convertLegacy').hidden = !convertRequired;
      document.getElementById('saveFile').hidden = convertRequired;
    }

    function renderStatusPill() {
      const badge = currentStatus?.badge || '-';
      statusBadge.textContent = badge;
      statusBadge.dataset.badge = badge;
      const label = statusLabel(currentStatus);
      statusText.textContent = label;
      statusPill.title = currentStatus?.tooltip || label;
    }

    function statusLabel(status) {
      if (!status) {
        return t('statusUnknown');
      }
      if (status.badge === 'M') {
        return t('statusM');
      }
      if (status.badge === 'S') {
        return t('statusS');
      }
      if (status.badge === 'Q') {
        return t('statusQ');
      }
      if (status.badge === 'E') {
        return t('statusE');
      }
      if (status.badge === 'R') {
        return t('statusR');
      }
      if (status.badge === 'OK') {
        return t('statusOK');
      }
      return status.tooltip || status.badge;
    }

    function t(key) {
      const bundle = i18n[language] || i18n['zh-CN'];
      return bundle[key] ?? i18n.en[key] ?? key;
    }

    function numberOr(value, fallback) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    }

    function updatePanelResize(event) {
      if (!resizingPanel) {
        return;
      }
      const workspaceRect = workspace.getBoundingClientRect();
      panelWidth = clampPanelWidth(workspaceRect.right - event.clientX);
      applyPanelLayout();
      renderCanvas();
      rememberState();
    }

    function finishPanelResize(event) {
      if (!resizingPanel) {
        return;
      }
      resizingPanel = false;
      workspace.classList.remove('resizing-panel');
      if (event && typeof event.pointerId === 'number') {
        try {
          splitter.releasePointerCapture(event.pointerId);
        } catch {}
      }
      renderCanvas();
      rememberState();
    }

    function clampPanelWidth(value) {
      return clamp(numberOr(value, panelWidth), 240, panelWidthMax());
    }

    function panelWidthMax() {
      const workspaceWidth = workspace.clientWidth || window.innerWidth || 800;
      return Math.max(240, Math.min(560, workspaceWidth - 220));
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function round4(value) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.round(numeric * 10000) / 10000 : 0;
    }

    function safeColor(value, fallback) {
      if (typeof value !== 'string') {
        return fallback;
      }
      if (value === 'none') {
        return 'none';
      }
      return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
    }

    function isLegacyConvertRequired() {
      return diagram && (diagram.formatSupport === 'legacy-binary' || diagram.formatSupport === 'legacy-opaque');
    }

    vscode.postMessage({ command: 'ready' });
  </script>
</body>
</html>`;
  }
}

export class VsdxInteractiveDocument implements vscode.CustomDocument {
  private readonly panels = new Set<vscode.WebviewPanel>();

  constructor(
    readonly uri: vscode.Uri,
    private bytes: Buffer,
    private diagram: VsdxEditorDiagram,
    private readonly statusProvider?: VsdxStatusProvider
  ) {}

  dispose(): void {
    this.panels.clear();
  }

  addPanel(panel: vscode.WebviewPanel): void {
    this.panels.add(panel);
    panel.onDidDispose(() => this.panels.delete(panel));
  }

  async postState(panel: vscode.WebviewPanel): Promise<void> {
    await panel.webview.postMessage({
      command: 'load',
      diagram: this.diagram,
      status: await this.readStatus()
    });
  }

  broadcastState(): void {
    for (const panel of this.panels) {
      void this.postState(panel);
    }
  }

  broadcastSaved(): void {
    for (const panel of this.panels) {
      void this.postSavedState(panel);
    }
  }

  applyShapeUpdate(update: VsdxEditorShapeUpdate): void {
    this.diagram = replaceShapeInDiagram(this.diagram, update);
  }

  async saveTo(destination: vscode.Uri): Promise<void> {
    const bytes = await this.toBytes();
    await vscode.workspace.fs.writeFile(destination, bytes);
    if (destination.toString() === this.uri.toString()) {
      this.bytes = Buffer.from(bytes);
      this.broadcastSaved();
    }
  }

  async revert(): Promise<void> {
    const { bytes, diagram } = await readVsdxDiagramFromFile(this.uri.fsPath);
    this.bytes = bytes;
    this.diagram = diagram;
  }

  async toBytes(): Promise<Buffer> {
    return writeVsdxDiagram(this.bytes, this.diagram);
  }

  private async readStatus(): Promise<VsdxEditorStatus | undefined> {
    if (!this.statusProvider) {
      return undefined;
    }

    try {
      return await this.statusProvider(this.uri.fsPath);
    } catch {
      return undefined;
    }
  }

  private async postSavedState(panel: vscode.WebviewPanel): Promise<void> {
    await panel.webview.postMessage({
      command: 'saved',
      status: await this.readStatus()
    });
  }
}

function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return nonce;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
