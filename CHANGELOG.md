# Changelog

All notable changes to AI-FDE VSDX Radar are documented in this file.

## 0.2.1 - 2026-06-13

### Changed

- Promoted the extension to the `0.2.x` line after the VSDX semantic preview moved beyond the initial `0.1.x` patch train.
- Added repository versioning guidance so future releases use minor versions for meaningful renderer/editor capability growth and patch versions for narrow fixes.

### Fixed

- Improved manual Visio-created VSDX rendering for inherited cached paint, ratio transparency, hidden geometry sections, Scratch row formula references, elliptical arcs, and true Visio line weights.
- Kept selection highlighting separate from original Visio shape strokes so selected shapes no longer mutate the document stroke preview.
- Improved default-open recovery for restored `.vsdx` text/binary tabs, Visio lock/temp file handling, and QA/cache status separation.
- Added static lint checks and editor/QA regression fixtures for the new VSDX rendering and lock-file behavior.

### Validation

- Passed `npm run lint`, `npm run test:editor`, `npm run test:qa`, and `npm run package`.
- Packaged `ai-fde-vsdx-radar-0.2.1.vsix`; GUI release acceptance still requires installing `0.2.1` and rerunning the normal-profile 200% full-screen checks.

## 0.1.50 - 2026-06-12

### Fixed

- Start the extension earlier when a workspace contains Visio files and poll briefly during startup so restored `.vsdx` text/binary tabs are reopened with the interactive editor without waiting for a manual click.

## 0.1.49 - 2026-06-12

### Fixed

- Fixed the interactive editor toolbar at 200% Windows scaling by keeping controls on a single scrollable toolbar row instead of letting buttons overflow under the window edge.

## 0.1.48 - 2026-06-12

### Fixed

- Recover Visio files that VS Code restores as text/binary tabs by reopening them with the interactive preview editor from the tab layer on startup and tab changes.
- Hide Visio `~$$*.~vsdx` lock files by default, ignore them in scans, and show an ignored lock-file page if one is opened directly instead of displaying binary noise.
- Scroll the interactive editor's first view to the actual page content bounds so drawings placed lower on the page are visible immediately.
- Keep missing/stale preview cache states out of content QA risks and update docs/assets to describe them as preview status only.

## 0.1.47 - 2026-06-12

### Fixed

- Recover visible Visio files that VS Code restores as text editors by reopening them with the interactive preview editor on startup.


## 0.1.46 - 2026-06-12

### Added

- Added Visio paragraph before/after spacing metadata (`SpBefore`, `SpAfter`) so multi-line labels can preserve paragraph spacing in SVG preview.
- Preserves paragraph spacing inheritance through direct shape cells, Paragraph sections, TextStyle StyleSheets, master-shape inheritance, formula cells, and legacy Visio XML files.
- Added regression coverage for modern package direct/Paragraph/StyleSheet paragraph spacing and legacy XML direct/TextStyle paragraph spacing.

## 0.1.45 - 2026-06-12

### Added

- Added Visio paragraph line spacing metadata (`SpLine`) so multi-line labels can preserve absolute or font-relative line spacing in SVG preview.
- Preserves line spacing inheritance through direct shape cells, Paragraph sections, TextStyle StyleSheets, master-shape inheritance, formula cells, and legacy Visio XML files.
- Added regression coverage for modern package direct/Paragraph/StyleSheet line spacing and legacy XML direct/TextStyle line spacing.

## 0.1.44 - 2026-06-12

### Added

- Added Visio paragraph indent metadata (`IndFirst`, `IndLeft`, `IndRight`) so labels can preserve first-line, left, and right paragraph indentation in SVG preview.
- Preserves paragraph indent inheritance through direct shape cells, Paragraph sections, TextStyle StyleSheets, master-shape inheritance, formula cells, and legacy Visio XML files.
- Added regression coverage for modern package direct/Paragraph/StyleSheet indents and legacy XML direct/TextStyle paragraph indents.

## 0.1.43 - 2026-06-12

### Added

- Added Visio `Character.Pos` / `Pos` text metadata so superscript and subscript labels render with SVG baseline shifts.
- Preserves baseline position through direct shape cells, Character sections, TextStyle StyleSheets, master-shape inheritance, formula cells, and legacy Visio XML files.
- Added regression coverage for modern package direct/Character/StyleSheet baseline position and legacy XML direct/TextStyle baseline position.

## 0.1.42 - 2026-06-12

### Added

- Added Visio `DblUnderline` / `DoubleUnderline` text metadata so double-underlined labels render with SVG double underline decoration.
- Preserves double underline through direct shape cells, Character sections, TextStyle StyleSheets, master-shape inheritance, formula cells, and legacy Visio XML files.
- Added regression coverage for modern package direct/Character/StyleSheet double underline and legacy XML direct/TextStyle double underline.

## 0.1.41 - 2026-06-12

### Added

- Added Visio `Strikethru` and `DoubleStrikethrough` text metadata so deleted or deprecated diagram labels render with SVG line-through decoration.
- Preserves strikethrough through direct shape cells, Character sections, TextStyle StyleSheets, master-shape inheritance, formula cells, and legacy Visio XML files.
- Added regression coverage for modern package direct/Character/StyleSheet strikethrough and legacy XML direct/TextStyle strikethrough.

## 0.1.40 - 2026-06-12

### Added

- Added shape-level `FlipX` and `FlipY` metadata to the interactive editor model so flipped Visio shapes can render mirrored instead of losing orientation.
- Preserves flip metadata through direct shape cells, master-shape inheritance, formula cells, and legacy Visio XML files while keeping supported shapes editable.
- Added regression coverage for modern package direct flips, inherited master flips, and legacy XML flip metadata.

## 0.1.39 - 2026-06-12

### Added

- Added Geometry section-level rendering for Visio `NoFill`, `NoLine`, and `NoShow` cells so multi-geometry shapes no longer lose subpath paint visibility semantics when compiled to SVG.
- Preserves the existing compatibility `geometryPath` while exposing per-section `geometryPaths` for the interactive editor, including modern package and legacy Visio XML files.
- Added regression coverage for modern package and legacy XML Geometry section paint flags.

## 0.1.38 - 2026-06-12

### Fixed

- Fixed legacy Visio XML parsing for `LineColorTrans` so shape and connector stroke transparency render through the existing SVG opacity path.
- Added regression coverage for direct legacy XML line transparency and inherited legacy XML LineStyle transparency.

## 0.1.37 - 2026-06-12

### Fixed

- Fixed legacy Visio XML parsing for connector arrow types by collecting `BeginArrow` and `EndArrow` cells from legacy XML line blocks and styles.
- Added regression coverage for direct legacy XML connector arrows and inherited legacy XML LineStyle arrow types.

## 0.1.36 - 2026-06-12

### Added

- Added semantic support for Visio `TextPosAfterBullet` cells so left-aligned list text can render the intended post-bullet text position in the interactive SVG editor.
- Preserves `TextPosAfterBullet` inheritance through Paragraph sections, TextStyle StyleSheets, master shapes, and legacy Visio XML files.
- Added regression coverage for direct modern package values, paragraph-row formulas, inherited TextStyle values, master-style inheritance, and legacy Visio XML text-block metadata.

## 0.1.35 - 2026-06-12

### Added

- Added semantic support for Visio `Font` cells by resolving the document `FaceNames` table into SVG `font-family` rendering.
- Preserves font inheritance through direct shape cells, Character sections, TextStyle StyleSheets, master shapes, and legacy Visio XML files.
- Added regression coverage for modern package fonts, inherited TextStyle fonts, master-style font inheritance, and legacy Visio XML font metadata.

## 0.1.34 - 2026-06-12

### Added

- Added semantic support for Visio `ShapeShdwBlur` cells so blurred shadows render in the interactive SVG editor instead of using only hard-edged shadow offsets.
- Generates SVG blur filters only for pages that actually use blurred shadows, keeping the fast XML/ZIP preview path lightweight.
- Added regression coverage for direct modern Visio package blur cells, inherited FillStyle blur, master-style inheritance, and legacy Visio XML shadow blur metadata.

## 0.1.33 - 2026-06-12

### Added

- Added semantic support for Visio `Rounding` cells so fallback rectangle shapes render their intended rounded or square corners in the interactive editor.
- Applied the same rounded-corner metadata to lightweight shape shadows so shadow geometry stays aligned with the visible shape outline.
- Added regression coverage for direct modern Visio package rounding, inherited LineStyle rounding, master-style inheritance, and legacy Visio XML line rounding metadata.

## 0.1.32 - 2026-06-12

### Added

- Added semantic support for Visio Text Block margin cells: `LeftMargin`, `RightMargin`, `TopMargin`, and `BottomMargin`.
- Applied text margins to the interactive editor's SVG text layout while keeping text backgrounds on the full TextBlock bounds.
- Added regression coverage for direct modern Visio package margins, formula margins, inherited TextStyle margins, and legacy Visio XML `TextBlock` margin metadata.

## 0.1.31 - 2026-06-12

### Added

- Added semantic support for Visio paragraph and text-block alignment cells, including `HAlign`, `HorzAlign`, and `VerticalAlign`, so left, center, right, top, middle, and bottom text placement renders in the interactive editor.
- Added alignment inheritance through Paragraph sections, TextStyle styles, page-shape cells, formula cells, and legacy Visio XML `Para` / `TextBlock` paths.
- Added regression coverage for direct modern Visio package alignment, inherited StyleSheet alignment, and legacy Visio XML alignment metadata.

## 0.1.30 - 2026-06-12

### Added

- Added semantic support for Visio `Character.Style` bit flags so bold, italic, and underline text render in the interactive editor.
- Added text style inheritance through Character sections, StyleSheet, page-shape, formula, and legacy Visio XML paths.
- Added regression coverage for direct modern Visio package text styles, Character row formulas, inherited StyleSheet text style flags, and legacy Visio XML `Char` style metadata.

## 0.1.29 - 2026-06-12

### Added

- Added semantic support for Visio patterned fills that use `FillPattern`, `FillBkgnd`, and `FillBkgndTrans`, rendering lightweight SVG fill patterns in the interactive editor without invoking Visio COM.
- Added fill background inheritance through StyleSheet, master, page-shape, formula, and legacy Visio XML paths.
- Added regression coverage for direct modern Visio package pattern fills, inherited StyleSheet pattern fills, solid-fill fallback behavior, and legacy Visio XML fill background metadata.

## 0.1.28 - 2026-06-12

### Fixed

- Applied Visio `LinePattern` dash semantics to normal shape outlines, not only connector lines, so dashed boundaries, annotation boxes, and styled shape borders render more faithfully in the interactive editor.
- Reused one SVG dash-pattern path for shapes and connectors to keep line semantics consistent without adding a slower rendering path.

### Added

- Added regression coverage for shape line patterns from direct modern Visio package cells, StyleSheet inheritance, and legacy Visio XML line metadata.

## 0.1.27 - 2026-06-12

### Added

- Added semantic support for Visio shadow cells, including `ShdwPattern`, `ShdwForegnd`, `ShdwForegndTrans`, `ShapeShdwOffsetX`, `ShapeShdwOffsetY`, and `ShapeShdwScaleFactor`, so shape shadows render in the interactive editor.
- Added shadow inheritance through StyleSheet, master, page-shape, formula, and legacy Visio XML paths while staying on the fast local XML/ZIP preview path.
- Added regression coverage for direct modern Visio package shadows, inherited StyleSheet shadows, disabled shadows, and legacy Visio XML shadow metadata.

## 0.1.26 - 2026-06-12

### Added

- Added semantic support for Visio `TextBkgnd` and `TextBkgndTrans` cells so shape labels can render their intended text background color and transparency in the interactive editor.
- Added text background inheritance through StyleSheet, page-shape, and legacy Visio XML `TextBlock` paths.
- Added regression coverage for modern Visio package text backgrounds, legacy XML direct text backgrounds, and inherited legacy XML TextStyle backgrounds.

## 0.1.25 - 2026-06-12

### Added

- Added semantic support for Visio `BeginArrowSize` and `EndArrowSize` cells so connector arrowheads can render with small, medium, large, or extra-large marker variants instead of one fixed SVG marker size.
- Added arrow-size inheritance through StyleSheet, master, page-shape, formula, and legacy Visio XML paths.
- Updated numeric ShapeSheet cell resolution to prefer valid formulas over stale cached values, improving formula-authored Visio files while retaining cached-value fallback.

### Fixed

- Fixed connector arrow marker generation so each page defines only the arrow-size variants it actually needs.

## 0.1.24 - 2026-06-12

### Added

- Added semantic support for Visio `LineCap` cells so butt, round, and square line caps render in the interactive SVG editor instead of always using a fixed rounded connector cap.
- Added `LineCap` inheritance through StyleSheet, master, page-shape, and legacy Visio XML paths.
- Added regression coverage for direct legacy XML line caps and inherited modern/legacy line caps on shapes and connectors.

## 0.1.23 - 2026-06-12

### Added

- Added semantic text style support for Visio `Color` and `Size` cells so text color and font size render in the interactive editor instead of always using fixed black auto-sized labels.
- Added support for text formatting stored in `Character` sections, including StyleSheet, master, page-shape, and legacy Visio XML inheritance paths.
- Added regression coverage for modern Visio package text style cells, Character row styles, legacy XML `Char` elements, and inherited legacy XML TextStyle formatting.

## 0.1.22 - 2026-06-12

### Added

- Added semantic support for Visio `FillForegndTrans` and `LineColorTrans` cells so transparent fills and strokes render with matching SVG opacity in the interactive editor.
- Added formula-aware transparency handling, including guarded line transparency on connectors.
- Added regression coverage for shape fill transparency, shape stroke transparency, and connector stroke transparency.

## 0.1.21 - 2026-06-12

### Added

- Added semantic `TextXForm` support so Visio text boxes with independent position, size, or angle are rendered in their intended text region instead of always being centered in the shape bounds.
- Added `textBox` metadata to the editor model for modern Visio packages and Visio XML files, including formula-aware `TxtPinX`, `TxtPinY`, `TxtWidth`, `TxtHeight`, `TxtLocPinX`, `TxtLocPinY`, and `TxtAngle` cells.
- Added regression coverage for modern and legacy XML text box transform cells.

## 0.1.20 - 2026-06-12

### Fixed

- Fixed semantic preview for composite Visio masters that contain multiple top-level master shapes; inherited master content is no longer limited to the first top-level shape.
- Page instances now expand additional top-level master shapes as read-only semantic preview overlays, preserving lightweight editing for the page-owned instance while showing the inherited visual content.

### Added

- Added editor model regression coverage for multi-root master expansion and scaled page-coordinate placement.

## 0.1.19 - 2026-06-12

### Fixed

- Fixed semantic preview and lightweight editing for hand-authored Visio files whose core ShapeSheet transform cells only contain formulas (`F`) without cached numeric values (`V`).
- Formula-only shape position, size, stroke width, connector endpoints, connector arrows, and page-relative references such as `ThePage!PageWidth` are now resolved on the fast local XML/ZIP path.
- Grouped shape coordinate transforms and grouped write-back size preservation now use the same formula-aware cell reader, reducing read-only fallbacks for manually created diagrams.

### Added

- Added editor model regression coverage for formula-only transform cells, connector endpoints, local `Width` references, unit formulas, and numeric write-back after edits.

## 0.1.18 - 2026-06-12

### Changed

- Improved interactive editor save performance by avoiding a full Visio ZIP/XML re-parse after saving back to the same file; the editor now updates its byte cache and sends a lightweight saved-state message to open webviews.

### Fixed

- The interactive editor now clears its unsaved indicator after a successful save without forcing a full canvas reload.

## 0.1.17 - 2026-06-12

### Fixed

- Fixed XML write-back so modern package page XML and Visio XML (`.vdx`, `.vsx`, `.vtx`) saves emit a single XML declaration instead of duplicating the original parser-preserved declaration.

### Added

- Added editor model regression coverage for XML declaration de-duplication on both modern package page saves and legacy Visio XML saves.

## 0.1.16 - 2026-06-12

### Fixed

- Fixed grouped shape write-back so editable child shapes and grouped connectors are saved back in their original local Visio coordinates instead of writing page-space coordinates into the group.
- Fixed the same grouped-coordinate write-back path for Visio XML (`.vdx`, `.vsx`, `.vtx`) files.
- Preserved local child shape size when editing text inside rotated groups, preventing text-only saves from rewriting local width and height with page-space bounding-box dimensions.

### Added

- Added regression coverage for modern package grouped shape dragging, grouped connector endpoint dragging, legacy XML grouped write-back, and rotated-group text edits.

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
