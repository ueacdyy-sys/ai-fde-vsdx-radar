# Visio Rendering Coverage Matrix

This document records the VSDX semantics that matter for semantic preview and lightweight editing. It is not enough to test a few named shapes; Visio masters often compose many visible shapes from the same ShapeSheet geometry, inheritance, style, and group semantics.

## Primary Risk Model

The highest-risk Visio shapes are not only "complex-looking" shapes. They are shapes that use one or more of these features:

- Geometry rows beyond simple rectangles.
- Multiple Geometry sections with different `NoFill`, `NoLine`, or `NoShow` flags.
- Master shapes with nested child shapes.
- Group-local coordinates, flipped groups, rotated groups, or transformed child geometry.
- ShapeSheet formulas that reference `Width`, `Height`, `Scratch`, `Geometry`, `User`, `ThePage`, or another sheet.
- Theme/style inherited paint rather than direct RGB colors.
- Connector endpoints, connection rows, routed geometry, and text labels on lines.
- Text formatting inherited through `Character`, `Paragraph`, and style sheets.
- Foreign image data or clipping geometry.

## Geometry Row Coverage

Microsoft documents Visio Geometry sections as rows that define the vertices for lines and arcs that make up a shape, and notes that a shape can use multiple Geometry sections. The parser should treat this as the core compatibility surface.

| ShapeSheet row type | Current intent | Risk |
| --- | --- | --- |
| `MoveTo`, `LineTo` | Supported as direct straight path commands. | Low. |
| `RelMoveTo`, `RelLineTo` | Supported as relative-to-width/height path commands. | Medium if formulas mix relative and absolute references. |
| `ArcTo`, `RelArcTo` | Approximated through quadratic curves. | Medium; Visio arcs are elliptical in practice, so exactness can differ. |
| `EllipticalArcTo`, `RelEllipticalArcTo` | Supported through SVG arc generation. | High; endpoint/control/axis/ratio semantics are easy to get subtly wrong. |
| `QuadBezTo`, `RelQuadBezTo` | Supported as SVG quadratic curves. | Medium. |
| `CubBezTo`, `RelCubBezTo` | Supported as SVG cubic curves. | Medium. |
| `PolylineTo`, `RelPolylineTo` | Supported by parsing point formulas into line segments. | High; formulas can encode many vertex formats. |
| `NURBSTo` | Present in the row registry and approximated by sampled/path behavior where possible. | High; NURBS requires knot/weight/formula fidelity. |
| `SplineStart`, `SplineKnot` | Currently rendered conservatively as point-to-point path segments. | High; exact spline interpolation is not complete. |
| `Ellipse` | Supported as ellipse geometry. | Medium. |
| `InfiniteLine` | Supported as a visible line segment between the stored points. | Medium; true infinite-line behavior is not represented in SVG preview. |

## Named Visio Shape Families To Test

These are the shape families most likely to expose renderer gaps:

- Basic shapes: rectangle, square, rounded rectangle, circle, ellipse, triangle, diamond, pentagon, hexagon, octagon, star, cross, bracket/brace shapes.
- Block arrows: right/left/up/down arrows, chevrons, circular arrows, U-turn arrows, split arrows, curved arrows, callout arrows.
- Flowchart: document, multi-document, tagged document, manual operation, display, terminator, preparation, data, database, off-page reference, delay, stored data, internal storage.
- Connectors: straight, elbow, curved, dynamic connector, connector with arrowheads, connector with text, connector glued to group children.
- Containers and swimlanes: container boundary, list/container title, cross-functional flowchart lanes, separators.
- Callouts and annotations: speech bubbles, bracket callouts, leader lines, text boxes with rotated or formatted text.
- Network/UML/Azure-like stencil shapes: masters with nested children, icons, text sub-shapes, and theme colors.
- Image-backed shapes: shapes containing `ForeignData`, embedded images, SVG/PNG previews, or image clipping paths.
- Data graphics: icon sets, color-by-value overlays, callout sub-shapes, and hidden helper geometry.
- Timeline/Gantt/calendar shapes: formula-heavy masters with Scratch/User cells and repeated child shapes.

## Current Coverage Status

Strongest current status: code-gated semantic coverage is improving, but full Visio parity is not complete.

Covered by current code/tests:

- Direct and inherited master geometry.
- Nested group-local geometry, including transformed, rotated, and flipped groups.
- Hidden `Geometry.NoShow` sections without fallback rectangles.
- Geometry section `NoFill` / `NoLine` paint flags.
- Scratch row formula references, including zero-based XML rows mapped to one-based ShapeSheet names.
- Inherited cached paint values.
- Numeric transparency ratios.
- Document-unit stroke widths.
- Selection overlay that does not alter the original stroke.
- Connector labels through shared text rendering.
- Lock/temp files ignored by QA and open-tab recovery.

Known incomplete or high-risk:

- Exact NURBS and spline interpolation.
- Pixel-level Visio parity for some `EllipticalArcTo` cases, especially shapes like manual `Tagged document`.
- Full formula engine compatibility for advanced ShapeSheet functions.
- Gradient fills, advanced pattern fills, and some theme effects.
- Full image clipping and foreign object rendering.
- Full data graphics rendering.
- Full connector rerouting behavior and advanced arrowhead parity.
- Comprehensive GUI acceptance across all named shape families above.

## Regression Requirement

Before claiming broad Visio compatibility, add a corpus that includes at least one real Visio-created VSDX for each named family above. For each corpus file, store:

- The original VSDX.
- A Visio-exported PNG reference.
- The VS Code preview screenshot captured at Windows display scale 200%.
- A short known-gap note when exact parity is not expected yet.

The release status may be `code-gated` when code gates pass. It may be `gui-gated` only when normal-profile VS Code screenshots pass for the manual and AI VSDX acceptance files. Broad shape-family compatibility requires the corpus gate above.

## References

- Microsoft Learn: Geometry Section, Visio ShapeSheet reference.
- Microsoft Learn: Row element, Geometry Section, Visio XML.
- Microsoft Learn: Rows, Visio ShapeSheet reference.
- Microsoft Learn: ArcTo Row, Geometry Section.
