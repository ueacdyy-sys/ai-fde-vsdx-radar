# GUI Debug Gate

This project must not treat CLI success as GUI acceptance.

## Hard Rules

1. Load `C:\Users\Administrator\.codex\skills\vscode-visio-gui-debug-gate\SKILL.md` before reading, editing, packaging, or claiming completion for GUI/preview/rendering/default-open work.
2. Read `references/violations.md` and keep the counted violations visible.
3. Use the normal VS Code user profile for acceptance. Do not use isolated `--user-data-dir`.
4. Confirm the installed extension version:

```powershell
code --list-extensions --show-versions | Select-String -Pattern 'ai-fde-lab.ai-fde-vsdx-radar'
```

5. Confirm Windows display scale is 200% before screenshots.
6. Capture full-screen evidence, not cropped window evidence.
7. Use path-safe launch commands:

```powershell
& code.cmd --new-window "C:\Users\Administrator\Desktop\vsdx-radar-test" "C:\Users\Administrator\Desktop\vsdx-radar-test\新建 Microsoft Visio Drawing.vsdx"
```

8. Do not claim a GUI issue is fixed unless a full-screen screenshot proves it in normal VS Code.
9. Do not package `.validation`, `.aifde`, local screenshots, or temporary evidence.
10. Do not treat Visio lock/temp files such as `~$$*.~vsdx` as real content risks.

## Preflight

Run this before editing or reporting completion:

```powershell
pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Administrator\.codex\skills\vscode-visio-gui-debug-gate\scripts\preflight.ps1" -RepoPath "C:\Users\Administrator\Desktop\ai-fde-vsdx-radar" -TestDir "C:\Users\Administrator\Desktop\vsdx-radar-test"
```

The preflight checks normal-profile installed version, user settings, 200% scale, `.vscodeignore`, and this document.

## Priority Order

1. Manual Visio-created file blank/incorrect rendering root cause.
2. Real lint gates.
3. Lock-file and false-positive logic.
4. Right QA/status panel redesign.

## Layer Map

| Layer | Main code/tool surfaces | Acceptance evidence |
|---|---|---|
| VS Code open chain | `package.json` `workbench.editorAssociations`, `customEditors`, `activationEvents`; `registerVisioTextEditorRecovery`; `vscode.openWith` | Default open enters `aiFdeVsdxRadar.interactiveEditor` |
| Package/version chain | `npm run package`, `code --install-extension --force`, `code --list-extensions --show-versions` | Installed version equals packaged version |
| VSDX package parse | `readVsdxDiagramFromFile`, `readVsdxDiagram`, `readPageMetadata`, `readMasterShapes` | page/master XML expected by Visio exists and is loaded |
| Semantic model | `collectEditorShapes`, `toEditorShape`, `createMasterToPageTransform`, `compileGeometryPaths`, `readShapeText` | model contains the visible Visio objects needed by GUI |
| Webview rendering | `resolveCustomEditor`, `renderCanvas`, `renderShape`, `renderConnector`, `fitPage`, `scrollToPageContent` | screenshot shows content, no blank page, no black blocks, no toolbar/splitter overlap |
| GUI evidence | full-screen screenshot script, visible VS Code window | 200% full-screen proof |

## Required Gates

Run code gates:

```powershell
npm run lint
npm run test:editor
npm run test:qa
npm run package
```

Install into the normal VS Code profile:

```powershell
code --install-extension "C:\Users\Administrator\Desktop\ai-fde-vsdx-radar\ai-fde-vsdx-radar-<version>.vsix" --force
```

Run GUI gates:

1. Close the current `vsdx-radar-test` VS Code window.
2. Open `新建 Microsoft Visio Drawing.vsdx` through normal VS Code.
3. Capture full screen at 200%.
4. Inspect the screenshot.
5. Repeat for `ai-render-baseline.vsdx`.

Only after both GUI gates pass can the build be described as release-ready.

## Required Status Language

- `未开工`: preflight and layer map are not complete.
- `排查中`: primary layer is selected and evidence collection is active.
- `代码门禁通过`: compile/lint/tests/package passed only.
- `GUI 默认打开通过`: normal VS Code profile default-open screenshot proves custom editor opened.
- `GUI 渲染通过`: full-screen screenshot proves visible diagram content is rendered correctly.
- `可发布`: code gates and GUI gates pass for manual and AI VSDX.

Never say `修好了`, `完成`, `已经解决`, `发布吧`, or `可发布` unless the matching GUI gate has passed.

## Recorded Process Violations

| Ignored rule | Minimum count |
|---|---:|
| Code/CLI evidence used before GUI acceptance | at least 4 |
| Isolated VS Code profile used despite being invalid | 1 |
| Bad launch command split a path with spaces into multiple tabs | 1 |
| Window-region screenshot used where 200% full-screen evidence was required | at least 3 |
| GUI screenshot failure was not treated as product truth quickly enough | at least 2 |
| Validation screenshots were packaged into VSIX before exclusion | 2 package runs |
| Stale webview state was reused after viewport logic changed | 1 |
| Explicit layer map was skipped before edits | at least 1 major cycle |
| Lock/temp/cache state was treated as content QA noise | at least 1 |
| Release readiness was implied before full GUI gates | at least 1 |
