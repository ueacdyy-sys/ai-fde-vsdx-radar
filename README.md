# AI-FDE VSDX Radar

AI-FDE VSDX Radar brings Microsoft Visio `.vsdx` review into VS Code: export local previews, lint diagram structure, and collect review evidence without leaving the editor.

![AI-FDE VSDX Radar preview](images/marketplace-preview.png)

## What It Does

- Exports `.vsdx` files to cached PNG or PDF previews through local Microsoft Visio automation.
- Supports multi-page diagrams with one preview per page.
- Parses `.vsdx` XML and writes `.aifde/qa/*.qa.json` plus `.qa.md` summaries.
- Flags common delivery risks: missing or stale previews, empty pages, duplicate Shape IDs, unlabeled shapes, low connector ratio, diagonal connectors, connectors crossing nodes, dangling connectors, overlapping shapes, page coverage issues, and out-of-bounds shapes.
- Adds Explorer context menu commands for preview, QA, status, and artifact reveal actions.
- Generates workspace reports, risk reports, due-risk reports, team review boards, calendar exports, and a webview dashboard for filtering and assigning diagram risks.
- Supports QA profile templates, import/export, config diff, profile stacks, and profile audit history.

## Requirements

- VS Code 1.90 or newer.
- Windows with PowerShell 7.6.2 available as `pwsh`.
- Microsoft Visio for Windows with a usable local license for high-fidelity preview export.
- Local filesystem workspace; virtual and untrusted workspaces are intentionally disabled.

The QA linter reads `.vsdx` XML locally. High-fidelity preview export requires Visio COM automation.

## Quick Start

1. Open a workspace containing `.vsdx` files.
2. Right-click a `.vsdx` file.
3. Run `AI-FDE: Export Preview and QA`.
4. Open the generated preview from `.aifde/previews`.
5. Open the generated QA summary from `.aifde/qa`.

Useful commands:

- `AI-FDE: Export Preview and QA`
- `AI-FDE: Open VSDX Preview`
- `AI-FDE: Open All VSDX Previews`
- `AI-FDE: Open VSDX QA Report`
- `AI-FDE: Show VSDX Status`
- `AI-FDE: Reveal VSDX Artifacts`
- `AI-FDE: Generate Workspace VSDX Report`
- `AI-FDE: Generate Workspace VSDX Risk Report`
- `AI-FDE: Open Workspace VSDX Risk Dashboard`
- `AI-FDE: Generate VSDX Demo Pack`

## Output Layout

```bash +code
.aifde/
  previews/                # PNG/PDF preview cache
  qa/                      # Per-file QA JSON and Markdown summaries
  reports/                 # Workspace, risk, team, config, and demo reports
  acceptance/              # Local release acceptance reports
  cache-index.json         # Preview freshness and QA cache metadata
```

## QA Evidence

Each QA JSON report includes:

- Source path and source modified time.
- Preview path, preview freshness state, and freshness reasons.
- Page, shape, text shape, unlabeled shape, connector, route, crossing, overlap, and coverage statistics.
- Risk list with severity, code, page, and message.

The Markdown summary mirrors the same evidence for human review.

## Dashboard And Reports

The workspace dashboard helps teams triage diagram delivery risk:

- Filter by status, risk code, preview freshness reason, owner, processing status, and keyword.
- Sort by priority, due date, owner, status, or file name.
- Assign owner, due date, processing state, and remediation notes.
- Export due-risk items to an `.ics` calendar file.
- Generate team-board reports for standups or design reviews.

## Configuration

| Setting | Default | Description |
| ------- | ------- | ----------- |
| `aiFdeVsdxRadar.pwshPath` | `pwsh` | PowerShell 7.6.2 executable path. |
| `aiFdeVsdxRadar.outputDirectory` | `.aifde` | Workspace-relative artifact directory. |
| `aiFdeVsdxRadar.previewFormat` | `png` | Preview format: `png` or `pdf`. |
| `aiFdeVsdxRadar.qaPreset` | `custom` | QA preset: `custom`, `balanced`, `strict`, or `quiet`. |
| `aiFdeVsdxRadar.autoExportOnSave` | `false` | Automatically export preview and QA when `.vsdx` files change. |
| `aiFdeVsdxRadar.exportTimeoutMs` | `120000` | Visio export timeout in milliseconds. |

Additional settings expose QA thresholds and switches for shape density, connector ratio, unlabeled shapes, page coverage, diagonal connectors, connector crossings, dangling connectors, and shape overlap checks.

## Local Verification

```bash +code
npm install
npm run marketplace:assets
npm run marketplace:check
npm run verify
npm run qa:evidence
npm run demo:pack
npm run demo:pack:check:strict
npm run package
```

Full local release gate:

```bash +code
npm run acceptance
```

The acceptance gate verifies manifest contributions, QA fixtures, single-page and multi-page Visio export, real Visio QA smoke tests, QA evidence generation, VSIX packaging, local VSIX installation, and strict Demo Pack freshness.

## Marketplace Publishing

The proposed extension ID is:

```bash +code
ai-fde-lab.ai-fde-vsdx-radar
```

Before publishing, confirm the final Marketplace publisher ID and GitHub repository. If they differ, update `publisher`, `repository`, `bugs`, and `homepage` in `package.json`, then rerun:

```bash +code
npm run marketplace:check
npm run acceptance
```

See `docs/publishing.md` for the release checklist.

## Limitations

- Preview export is Windows-only because it uses local Visio COM automation.
- QA rules are structural and heuristic; they complement but do not replace human diagram review.
- This first public release is marked as Preview in the Marketplace.
