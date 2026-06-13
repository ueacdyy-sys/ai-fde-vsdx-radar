import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const failures = [];

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function fail(message) {
  failures.push(message);
}

const qaParser = read('src/qa/vsdxParser.ts');
if (/risks\.push\(\s*\{[\s\S]{0,240}code:\s*['"]PREVIEW_(?:MISSING|STALE)['"]/.test(qaParser)) {
  fail('Preview cache state must not be pushed into QA content risks.');
}
if (!qaParser.includes('isVisioLockFilePath(sourcePath)') || !qaParser.includes('visio lock/temp file ignored') || !qaParser.includes('emptyQaStats')) {
  fail('QA parser must short-circuit Visio lock/temp files without content risks.');
}

const extension = read('src/extension.ts');
if (/badge\s*!==\s*['"]OK['"]/.test(extension)) {
  fail('Use isContentRiskBadge(...) instead of badge !== OK for risk filtering.');
}
if (/badge\s*===\s*['"]OK['"]\s*\?\s*0\s*:\s*1/.test(extension)) {
  fail('Use isContentRiskBadge(...) when counting content risks.');
}
if (!extension.includes('registerVisioTextEditorRecovery') || !extension.includes('tabGroups.onDidChangeTabs') || !extension.includes('TabInputText')) {
  fail('Visio files opened as text/binary tabs must be recovered with vscode.openWith.');
}
if (!extension.includes('startupRecoveryDelays') || !extension.includes('pending')) {
  fail('Visio text/binary tab recovery must poll briefly during startup and avoid duplicate openWith attempts.');
}
if (!extension.includes('getVsdxContentRiskStatus') || !extension.includes('private readonly cache = new Map')) {
  fail('File decorations must use cached lightweight content-risk status, not full preview freshness checks.');
}
if (/provideFileDecoration[\s\S]{0,900}getVsdxStatus/.test(extension)) {
  fail('File decorations must not call getVsdxStatus because it computes preview freshness and can slow cold start.');
}

const manifest = JSON.parse(read('package.json'));
const vscodeIgnore = read('.vscodeignore');
if (!manifest.activationEvents?.includes('onStartupFinished')) {
  fail('onStartupFinished activation is required to recover Visio files restored as text/binary editors.');
}
if (!manifest.activationEvents?.includes('workspaceContains:**/*.vsdx')) {
  fail('workspaceContains:**/*.vsdx activation is required to start earlier in Visio workspaces.');
}
const editorAssociations = manifest.contributes?.configurationDefaults?.['workbench.editorAssociations'] ?? {};
const filesExclude = manifest.contributes?.configurationDefaults?.['files.exclude'] ?? {};
if (editorAssociations['*.vsdx'] !== 'aiFdeVsdxRadar.interactiveEditor') {
  fail('*.vsdx must default to the interactive editor.');
}
if (Object.keys(editorAssociations).some(pattern => pattern.includes('.~vs'))) {
  fail('Visio lock/temp files must not be registered as editor associations.');
}
const customEditorSelectors = manifest.contributes?.customEditors?.flatMap(editor => editor.selector ?? []) ?? [];
if (customEditorSelectors.some(selector => String(selector.filenamePattern ?? '').includes('.~vs'))) {
  fail('Visio lock/temp files must not be registered as custom editor selectors.');
}
if (filesExclude['**/~$$*.~vsdx'] !== true) {
  fail('Visio lock/temp files must be hidden by default in the Explorer.');
}
if (!/^\.validation\/\*\*$/m.test(vscodeIgnore)) {
  fail('.validation screenshots and local GUI evidence must be excluded from VSIX packages.');
}
if (!existsSync(path.join(root, 'docs/gui-debug-gate.md'))) {
  fail('docs/gui-debug-gate.md is required so GUI acceptance rules stay visible in the repo.');
}
if (!/^\.aifde\/\*\*$/m.test(vscodeIgnore)) {
  fail('.aifde generated preview and QA artifacts must be excluded from VSIX packages.');
}
const guiGateDocPath = path.join(root, 'docs/gui-debug-gate.md');
if (existsSync(guiGateDocPath)) {
  const guiGateDoc = read('docs/gui-debug-gate.md');
  const requiredGatePhrases = [
    'vscode-visio-gui-debug-gate',
    'preflight.ps1',
    'normal VS Code user profile',
    '200%',
    'full-screen evidence',
    'Priority Order',
    'Required Status Language',
    'Recorded Process Violations',
    'Code/CLI evidence used before GUI acceptance',
    'Window-region screenshot used where 200% full-screen evidence was required',
    'Manual Visio-created file blank/incorrect rendering root cause',
    'Never say `修好了`, `完成`, `已经解决`, `发布吧`, or `可发布`'
  ];
  for (const phrase of requiredGatePhrases) {
    if (!guiGateDoc.includes(phrase)) {
      fail(`docs/gui-debug-gate.md must preserve GUI gate phrase: ${phrase}`);
    }
  }
}

const formats = read('src/visioFormats.ts');
if (!formats.includes('isVisioLockFilePath') || !formats.includes("startsWith('~$$')")) {
  fail('Visio lock/temp files must be explicitly ignored through isVisioLockFilePath.');
}
if (!/function\s+isLegacyVisioPath[\s\S]*?isVisioLockFilePath[\s\S]*?return false/.test(formats)) {
  fail('Legacy Visio path detection must ignore Visio lock/temp files.');
}

const interactiveEditor = read('src/editor/vsdxInteractiveEditor.ts');
if (!interactiveEditor.includes('scrollToPageContent') || !interactiveEditor.includes('pageContentBounds')) {
  fail('Interactive editor must scroll the initial view to the rendered page content bounds.');
}
if (!interactiveEditor.includes('editorStateVersion')) {
  fail('Interactive editor must version persisted webview state so stale zoom/scroll state cannot mask GUI fixes.');
}
if (!/const\s+editorStateVersion\s*=\s*[4-9]\d*/.test(interactiveEditor)) {
  fail('Interactive editor state version must be bumped after adding scroll-aware restore logic.');
}
if (!/render\(\);\s*fitPage\(\);/.test(interactiveEditor)) {
  fail('Interactive editor must fit and reveal rendered content on every document open.');
}
if (!/function\s+fitPage\(\)\s*\{[\s\S]{0,260}pageContentBounds\(page\)[\s\S]{0,520}fitWidth[\s\S]{0,260}fitHeight[\s\S]{0,260}scrollToPageContent\(page\)/.test(interactiveEditor)) {
  fail('Fit page must fit the actual rendered content bounds, not only the full blank Visio page.');
}
if (!interactiveEditor.includes('viewportIntersectsPageContent') || !interactiveEditor.includes('rectanglesIntersect')) {
  fail('Interactive editor must verify restored viewport intersects rendered page content.');
}
if (!interactiveEditor.includes('pageFocusBounds') || !/pageContentBounds\(page,\s*shape\s*=>\s*shape\.editable\)/.test(interactiveEditor)) {
  fail('Initial viewport must focus editable page shapes before inherited master preview fragments.');
}
if (!/scroll:\s*\{[\s\S]{0,120}left:\s*canvasWrap\.scrollLeft[\s\S]{0,120}top:\s*canvasWrap\.scrollTop/.test(interactiveEditor)) {
  fail('Interactive editor must persist canvas scroll coordinates in VS Code webview state.');
}
if (!/canvasWrap\.addEventListener\(['"]scroll['"][\s\S]{0,180}rememberState/.test(interactiveEditor)) {
  fail('Interactive editor must update persisted state after user canvas scrolling.');
}
if (!interactiveEditor.includes('panelCollapsed = restoreDocumentState ? Boolean(saved.panelCollapsed) : true;')) {
  fail('Interactive editor must keep the inspector collapsed by default for newly loaded documents.');
}
if (!/function\s+selectShape\(id\)\s*\{[\s\S]*?panelCollapsed\s*=\s*false[\s\S]*?applyPanelLayout\(\)/.test(interactiveEditor)) {
  fail('Selecting a shape must reopen the inspector so lightweight editing stays discoverable.');
}
if (/\.status-badge\[data-badge="M"\][\s\S]{0,180}\.status-badge\[data-badge="R"\][\s\S]{0,120}vscode-editorWarning-foreground/.test(interactiveEditor)) {
  fail('M/S/Q are cache or QA artifact states and must not share the warning badge styling reserved for R.');
}
if (!/card\.open\s*=\s*currentStatus\?\.badge\s*===\s*['"]E['"]\s*\|\|\s*currentStatus\?\.badge\s*===\s*['"]R['"]/.test(interactiveEditor)) {
  fail('Status details must only auto-open for real QA risk badges E/R.');
}
if (!interactiveEditor.includes('function statusSection') || !interactiveEditor.includes("t('qaResult')") || !interactiveEditor.includes("t('cacheState')")) {
  fail('Status panel must separate QA result from cache/report state.');
}
if (!interactiveEditor.includes('function statusIsContentRisk') || !interactiveEditor.includes("t('cacheOnlyState')")) {
  fail('Status panel must label M/S/Q as cache/report states, not content risks.');
}
if (/\.shape-outline\s*\{[\s\S]{0,120}vector-effect\s*:\s*non-scaling-stroke/.test(interactiveEditor)) {
  fail('Document shape outlines must scale from Visio document units; reserve non-scaling-stroke for screen UI handles only.');
}
if (/function\s+renderConnector[\s\S]*?setAttribute\(['"]vector-effect['"],\s*['"]non-scaling-stroke['"]\)/.test(interactiveEditor)) {
  fail('Document connector strokes must scale from Visio document units; reserve non-scaling-stroke for screen UI handles only.');
}
if (!interactiveEditor.includes('function documentStrokeWidth') || !/documentStrokeWidth\(shape,\s*0\.02\)/.test(interactiveEditor)) {
  fail('Shape stroke widths must pass through documentStrokeWidth so Visio line weights remain visible in SVG document units.');
}
if (/\.selected\s+\.shape-outline/.test(interactiveEditor) || !interactiveEditor.includes('selection-outline')) {
  fail('Selection highlight must use a separate overlay and must not override the original Visio shape stroke.');
}
if (!/function\s+renderShapeText/.test(interactiveEditor) || !/function\s+renderConnector[\s\S]*?renderShapeText\(group,\s*page,\s*shape/.test(interactiveEditor)) {
  fail('Connector labels must reuse the shared shape text renderer so VSDX connector text is visible in the webview.');
}

const editorModel = read('src/editor/vsdxModel.ts');
if (!editorModel.includes('isVisioLockFilePath(sourceName)')) {
  fail('Interactive editor model must show a lock-file ignored page instead of parsing Visio lock/temp files.');
}
if (/return\s+isVisioPath\(filePath\)\s*\|\|\s*isVisioLockFilePath\(filePath\)/.test(extension)) {
  fail('Open-tab recovery must not reopen Visio lock/temp files in the interactive editor.');
}
if (!/function\s+isRecoverableVisioEditorPath\(filePath:\s*string\):\s*boolean\s*\{[\s\S]{0,180}isVisioLockFilePath\(filePath\)[\s\S]{0,120}return false[\s\S]{0,120}return isVisioPath\(filePath\)/.test(extension)) {
  fail('Open-tab recovery must explicitly reject Visio lock/temp files before openWith.');
}
if (!/async function\s+resolveTargetPath[\s\S]{0,240}isVisioLockFilePath\(uri\.fsPath\)[\s\S]{0,240}return undefined/.test(extension)) {
  fail('Command target resolution must explicitly ignore Visio lock/temp URI inputs.');
}

if (!editorModel.includes('suppressDefaultGeometry') || !/function\s+compileGeometry\(shape:\s*any,\s*masterShape:\s*any,\s*targetWidth:\s*number,\s*targetHeight:\s*number\):\s*CompiledGeometry/.test(editorModel)) {
  fail('Editor model must distinguish hidden Visio geometry from missing geometry so the webview does not draw fallback rectangles.');
}
if (!interactiveEditor.includes('shape.suppressDefaultGeometry !== true')) {
  fail('Interactive editor must not draw default rectangles for shapes whose Visio geometry is explicitly hidden.');
}
if (!/function\s+rowNumberForSection[\s\S]{0,240}sectionHasZeroBasedRows[\s\S]{0,160}Math\.trunc\(ix\)\s*\+\s*1/.test(editorModel)) {
  fail('Formula reference rows must handle zero-based Scratch rows as one-based ShapeSheet names.');
}

const editorFixture = read('src/test/runEditorModelFixture.ts');
if (!editorFixture.includes('verifiesHiddenGeometryDoesNotFallbackToRectangle')) {
  fail('Editor model fixtures must cover hidden Geometry.NoShow sections not falling back to rectangles.');
}
if (!editorFixture.includes('verifiesScratchRowsUseOneBasedFormulaNames')) {
  fail('Editor model fixtures must cover zero-based Scratch row formula names.');
}

const qaFixture = read('src/test/runQaFixture.ts');
if (!qaFixture.includes('~$$manual.~vsdx') || !qaFixture.includes('expected Visio lock/temp files not to create content QA risks')) {
  fail('QA fixtures must cover Visio lock/temp files producing no content risks.');
}

if (existsSync(root)) {
  const leakedScreenshots = readdirSync(root)
    .filter(name => /^\.codex-vscode-.*\.png$/i.test(name) || /^verify-vscode-.*\.png$/i.test(name));
  if (leakedScreenshots.length > 0) {
    fail(`Remove local VS Code verification screenshots before packaging: ${leakedScreenshots.join(', ')}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`lint-static: ${failure}`);
  }
  process.exit(1);
}

console.log('Static lint checks passed.');
