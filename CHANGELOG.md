# Changelog

All notable changes to AI-FDE VSDX Radar are documented in this file.

## 0.1.15 - 2026-06-12

### Added

- Added StyleSheet inheritance for modern Visio packages so hand-authored `.vsdx`, `.vsdm`, `.vssx`, `.vssm`, `.vstx`, and `.vstm` files can inherit fill, line, stroke width, connector dash, and connector arrow semantics from `visio/document.xml`.
- Added regression coverage for page-level and master-level StyleSheet inheritance, including connector line patterns and arrows.

### Changed

- The interactive editor now resolves an effective ShapeSheet cell layer from StyleSheet, master shape, and page shape data before rendering, while keeping normal open on the fast local XML/ZIP path instead of invoking Visio COM.
- Visio indexed color values such as `0` and `1` are normalized for semantic rendering, with RGB formulas taking precedence when Visio stores a computed cache value beside a formula.

## 0.1.14 - 2026-06-12

### Added

- Added semantic connector styling for Visio `BeginArrow`, `EndArrow`, and `LinePattern` cells in the interactive editor.
- Added SVG arrow markers and dashed/dotted connector rendering so flow direction and line semantics are visible without invoking Visio COM during normal open.
- Added editor model regression coverage for connector arrow and line pattern extraction.
- Added an in-editor conversion action for legacy `.vsd`, `.vss`, `.vst`, `.vdw`, `.vwi`, and `.vsw` files so every recognized Visio extension has a visible next step from the same VS Code preview surface.
- Added workspace report, risk dashboard, and risk-open coverage for all recognized Visio extensions, with legacy files tagged as `LEGACY_CONVERSION_REQUIRED` until converted.

## 0.1.13 - 2026-06-12

### Added

- Added semantic rendering support for images stored through master relationships, so hand-authored Visio picture shapes that inherit image data from a master are no longer shown as empty frames.
- Added semantic rendering support for inline Visio XML image payloads inside `ForeignData`, including base64 PNG/JPEG/GIF/BMP/WebP/SVG detection.
- Added editor model regression coverage for master relationship images and Visio XML inline image data.

### Changed

- Image extraction now uses the same data-URI rendering path for page relationships, master relationships, and inline Visio XML image data without invoking Visio COM during normal open.

## 0.1.12 - 2026-06-12

### Added

- Added `AI-FDE: 转换旧 Visio 为现代格式 / Convert Legacy Visio to Modern Package` for explicit conversion of `.vsd`, `.vss`, `.vst`, `.vdw`, `.vwi`, and `.vsw` files through local Microsoft Visio COM automation.
- Added safe converted-output naming beside the source file: `.vsd -> .converted.vsdx`, `.vss -> .converted.vssx`, `.vst -> .converted.vstx`, with automatic `-2`, `-3`, and timestamp fallbacks instead of overwriting existing files.
- Added `aiFdeVsdxRadar.convertTimeoutMs` so legacy conversion can have its own timeout without changing normal preview export behavior.
- Added regression coverage for legacy conversion extension mapping and non-overwrite output naming.
- Added a real Visio COM conversion smoke test for generating a legacy `.vsd`, converting it to `.vsdx`, and checking `visio/pages/page*.xml`.

### Changed

- Legacy files now show conversion as the primary Explorer action, while semantic Visio files keep the direct interactive editor action.
- Legacy warning text now points users to the explicit conversion command before semantic preview and lightweight editing.

## 0.1.11 - 2026-06-12

### Added

- Added a direct resize handle for editable, non-rotated shapes in the interactive editor.
- Added regression coverage for shape resize write-back and Visio XML resize write-back.

### Changed

- Shape resize write-back now synchronizes `LocPinX` and `LocPinY` to the resized shape center for both modern Visio packages and Visio XML files, preventing stale location-pin formulas from pulling edited shapes out of position when reopened in Visio.

## 0.1.10 - 2026-06-12

### Added

- Added a unified Visio format registry for semantic formats, legacy XML formats, legacy binary files, and legacy opaque containers.
- Registered the interactive editor, Explorer commands, open dialogs, workspace scanning, and file watcher for Visio XML files (`.vdx`, `.vsx`, `.vtx`).
- Added read-only recognition pages for additional legacy Visio containers (`.vdw`, `.vwi`, `.vsw`) instead of mis-parsing them as modern packages.
- Added semantic preview, lightweight shape/text write-back, connector endpoint write-back, and QA statistics for basic Visio XML drawings.
- Added read-only master preview fallback for Visio XML stencil/template files that contain masters but no regular pages.
- Added editor/QA regression coverage for Visio XML drawings, Visio XML stencil fallback, opaque legacy formats, and rotated shape write-back.

### Changed

- Simple rotated shapes are now editable: the editor renders their stored `Angle`, allows dragging and text edits, and preserves the angle on save.
- Legacy conversion guidance now recommends either modern Visio packages (`.vsdx/.vsdm/.vssx/.vssm/.vstx/.vstm`) or Visio XML (`.vdx/.vsx/.vtx`) for semantic preview and lightweight editing.

## 0.1.9 - 2026-06-11

### Added

- Registered the interactive editor for modern Visio package formats: `.vsdx`, `.vsdm`, `.vssx`, `.vssm`, `.vstx`, and `.vstm`.
- Added read-only fallback pages for legacy binary Visio files (`.vsd`, `.vss`, `.vst`) so they are recognized without pretending to be semantically editable.
- Rendered stencil/template master shapes as read-only preview pages when a modern Visio package has no regular page XML.
- Added editor model regression coverage for legacy binary recognition, stencil master preview fallback, and connector write-back.

### Changed

- Synchronized connector `Begin*`/`End*`, bounding cells, and Geometry rows during lightweight connector edits so saved files do not retain stale bent routes.
- Cleared stale ShapeSheet formulas from cells that the editor writes explicitly, preventing Visio from recalculating over user edits.
- Expanded workspace scanning, file watching, open dialogs, and context menus from `.vsdx` only to the modern Visio package family.

## 0.1.8 - 2026-06-11

### Changed

- Preserved Visio rich text formatting markers (`cp`, `pp`, and `tp`) when editing shape text through the interactive editor.
- Replaced stale rich text payloads instead of appending new text alongside old nested text during VSDX write-back.

### Added

- Added editor model regression coverage for rich text write-back, XML escaping, and formatting marker preservation.

## 0.1.7 - 2026-06-11

### Added

- Expanded child shapes from composite VSDX masters into the interactive editor preview when page instances do not contain their own child shape XML.
- Scaled inherited master child shapes into the page instance coordinate system, including width, height, and text-bearing child shapes.
- Marked expanded master child shapes as read-only preview objects so they do not enter the page-shape write-back path.

## 0.1.6 - 2026-06-11

### Added

- Normalized VSDX color cells from hex values and `RGB(...)` / `THEMEGUARD(RGB(...))` formulas into webview-safe `#rrggbb` colors.
- Honored `FillPattern=0` and `LinePattern=0` as `none` so no-fill and no-line shapes are not rendered with fallback colors.
- Added editor model regression coverage for inherited master colors, RGB formula colors, and no-paint shapes.

## 0.1.5 - 2026-06-11

### Added

- Added a conservative ShapeSheet formula evaluator for geometry cells, including arithmetic, `Width`/`Height`, `Geometry*` and `Scratch*` references, and safe functions such as `GUARD`, `MIN`, `MAX`, and `ABS`.
- Merged page-level Geometry row overrides with master Geometry rows so inherited cells can still render instead of falling back to rectangles or missing paths.
- Evaluated `PolylineTo` and `NURBSTo` formula arguments through the same safe formula path.

### Changed

- `LineTo`, arc, and Bezier rows now require an existing current point; they no longer silently become `MoveTo` when a malformed or deleted first row is encountered.

## 0.1.4 - 2026-06-11

### Added

- Expanded semantic VSDX geometry rendering for common ShapeSheet rows, including `ArcTo`, `EllipticalArcTo`, `PolylineTo`, `NURBSTo`, `Ellipse`, `InfiniteLine`, `SplineStart`, `SplineKnot`, and relative `Rel*` rows.
- Rendered connector geometry paths when available, while preserving endpoint dragging and straight-line fallback after connector edits.
- Added editor model regression fixtures for advanced geometry rows, connector geometry, and master fallback when page geometry is incomplete.

### Changed

- Parsed VSDX pages and master files in parallel to keep editor opening on the lightweight XML path instead of waiting for Visio COM/PNG export.
- Fell back from incomplete page-level geometry to master geometry instead of showing an empty shape.

## 0.1.3 - 2026-06-11

### Added

- Began the semantic VSDX rendering upgrade by compiling Visio `Geometry` sections from page or master shapes into SVG paths.
- Rendered semantic geometry paths in the interactive editor before falling back to rectangle outlines.
- Expanded editor model fixtures to assert master-inherited geometry rendering.

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
