# Changelog

All notable changes to AI-FDE VSDX Radar are documented in this file.

## 0.1.2 - 2026-06-11

### Fixed

- Reduced cold-start overhead by removing eager workspace activation for folders that merely contain `.vsdx` files.
- Rendered hand-created Visio shapes that inherit geometry and colors from VSDX master shapes.
- Rendered embedded bitmap image relationships in the interactive editor preview.

### Added

- Editor model fixture coverage for master-inherited shapes and embedded image relationships.

## 0.1.1 - 2026-06-11

### Added

- Interactive `.vsdx` custom editor as the default VS Code open experience.
- Page switching, zoom controls, shape dragging, connector endpoint dragging, and lightweight text editing for supported VSDX shapes.
- Simplified Chinese and English UI controls for the interactive editor.
- File status explanation in the editor side panel, including clearer wording for missing preview cache (`M`).

### Changed

- `M` status now represents a missing preview cache warning instead of a linter/file-format error.
- Compacted the interactive editor toolbar so status badges no longer push common buttons out of the first row.
- Added a default VS Code editor association for `*.vsdx`.

### Support

- Added Chinese-friendly Marketplace wording, GitHub Issues guidance, and contact email `ueacdyy@gmail.com`.

## 0.1.0 - 2026-06-08

### Added

- Marketplace-ready metadata, icon, banner color, repository links, support notes, and publishing checklist.
- VSDX preview export through PowerShell 7.6.2 and local Microsoft Visio COM automation.
- Single-page and multi-page PNG preview cache under `.aifde/previews`.
- VSDX QA linter that writes `.aifde/qa/*.qa.json` and `.qa.md` evidence.
- Workspace report, risk report, due-risk report, team board, ICS export, and interactive risk dashboard.
- QA profile templates, config import/export, config diff, profile stack application, and profile audit report.
- Demo Pack generation and strict release gate for VSIX, previews, QA evidence, acceptance freshness, and storyboard artifacts.
- Automated marketplace check for icon, README, CHANGELOG, license, category, publisher, and image constraints.

### Verified

- Local VS Code installation: `ai-fde-lab.ai-fde-vsdx-radar@0.1.0`.
- PowerShell runtime: `7.6.2`.
- Single-page Visio smoke export.
- Multi-page Visio smoke export.
- 19 VSDX fixture QA JSON reports and 19 Markdown summaries.

### Known Limitations

- High-fidelity preview export requires Microsoft Visio for Windows with a usable license.
- The linter uses structural XML and heuristic layout rules; it does not replace human diagram review.
- This first public release is marked as Preview in the Marketplace.
