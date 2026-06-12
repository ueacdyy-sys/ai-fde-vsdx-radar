import * as assert from 'assert';
import * as path from 'path';
import JSZip from 'jszip';

import { readVsdxDiagram, replaceShapeInDiagram, writeVsdxDiagram } from '../editor/vsdxModel';
import { getModernVisioConversionExtension, resolveModernVisioConversionOutputPath } from '../exporter/visioConverter';

async function main(): Promise<void> {
  await verifiesMasterShapeGeometry();
  await verifiesCurvedGeometryRows();
  await verifiesAdvancedGeometryRows();
  await verifiesFormulaGeometryAndMasterRowInheritance();
  await verifiesFormulaOnlyShapeTransformCells();
  await verifiesTextBoxTransformCells();
  await verifiesColorFormulaAndNoPaint();
  await verifiesPaintTransparencyCells();
  await verifiesFillPatternBackgroundCells();
  await verifiesShapeLinePatternCells();
  await verifiesShapeRoundingCells();
  await verifiesShadowStyleCells();
  await verifiesTextStyleCells();
  await verifiesStyleSheetInheritanceForShapePaintAndConnectorStyle();
  await verifiesMasterChildShapeExpansion();
  await verifiesMultiRootMasterShapeExpansion();
  await verifiesStencilMasterFallbackPreview();
  await verifiesLegacyVisioBinaryGetsReadOnlyDiagram();
  await verifiesLegacyOpaqueVisioGetsReadOnlyDiagram();
  await verifiesLegacyXmlDrawingPreviewAndWriteBack();
  await verifiesLegacyXmlStyleSheetInheritance();
  await verifiesLegacyXmlStencilFallbackPreview();
  await verifiesRotatedShapeStaysEditableAndPreservesAngle();
  await verifiesShapeResizeWriteBackCentersLocPin();
  await verifiesGroupedShapeWriteBackUsesLocalCoordinates();
  await verifiesLegacyXmlGroupedShapeWriteBackUsesLocalCoordinates();
  await verifiesRotatedGroupedTextWriteBackPreservesLocalSize();
  await verifiesRichTextWriteBackPreservesFormattingMarkers();
  await verifiesConnectorWriteBackSynchronizesGeometry();
  await verifiesConnectorGeometryRows();
  await verifiesConnectorArrowAndLinePattern();
  await verifiesMasterFallbackWhenPageGeometryIsIncomplete();
  await verifiesEmbeddedImageRelationship();
  await verifiesMasterImageRelationship();
  await verifiesLegacyXmlInlineImageData();
  verifiesLegacyConversionOutputPolicy();
  console.log('Editor model fixture checks passed.');
}

function verifiesLegacyConversionOutputPolicy(): void {
  assert.strictEqual(getModernVisioConversionExtension('diagram.vsd'), '.vsdx');
  assert.strictEqual(getModernVisioConversionExtension('stencil.vss'), '.vssx');
  assert.strictEqual(getModernVisioConversionExtension('template.vst'), '.vstx');
  assert.strictEqual(getModernVisioConversionExtension('web-drawing.vdw'), '.vsdx');

  const source = path.join('C:\\work', 'diagram.vsd');
  assert.strictEqual(
    resolveModernVisioConversionOutputPath(source, () => false),
    path.join('C:\\work', 'diagram.converted.vsdx')
  );
  assert.strictEqual(
    resolveModernVisioConversionOutputPath(source, candidate => candidate.endsWith('diagram.converted.vsdx')),
    path.join('C:\\work', 'diagram.converted-2.vsdx')
  );
}

async function verifiesMasterShapeGeometry(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/masters/masters.xml', `<?xml version="1.0" encoding="UTF-8"?>
<Masters xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Master ID="2" Name="函数" NameU="Function"><Rel r:id="rId1"/></Master>
</Masters>`);
  zip.file('visio/masters/_rels/masters.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master1.xml"/>
</Relationships>`);
  zip.file('visio/masters/master1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<MasterContents>
  <Shapes>
    <Shape ID="5">
      <Cell N="Width" V="0.9842519685"/>
      <Cell N="Height" V="0.4921259842"/>
      <Cell N="LineColor" V="#111827"/>
      <Cell N="FillForegnd" V="#ffff80"/>
      <Section N="Geometry">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="0.9842519685"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="3"><Cell N="X" V="0.9842519685"/><Cell N="Y" V="0.4921259842"/></Row>
        <Row T="LineTo" IX="4"><Cell N="X" V="0"/><Cell N="Y" V="0.4921259842"/></Row>
        <Row T="LineTo" IX="5"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
      </Section>
    </Shape>
  </Shapes>
</MasterContents>`);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Function" Master="2">
      <Cell N="PinX" V="4.9"/>
      <Cell N="PinY" V="6.5"/>
      <Text>Manual text</Text>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'master-fixture.vsdx');
  const shape = diagram.pages[0]?.shapes[0];
  assert.ok(shape, 'expected shape to be parsed');
  assert.strictEqual(shape.kind, 'shape');
  assert.strictEqual(shape.editable, true);
  assert.strictEqual(shape.text, 'Manual text');
  assert.ok(Math.abs((shape.width ?? 0) - 0.9842519685) < 0.00001, 'expected width inherited from master');
  assert.ok(Math.abs((shape.height ?? 0) - 0.4921259842) < 0.00001, 'expected height inherited from master');
  assert.strictEqual(shape.fill, '#ffff80');
  assert.ok(shape.geometryPath?.startsWith('M 0 0.4921'), 'expected geometry path inherited from master');
}

async function verifiesCurvedGeometryRows(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/masters/masters.xml', `<?xml version="1.0" encoding="UTF-8"?>
<Masters xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Master ID="2" NameU="Curved"><Rel r:id="rId1"/></Master>
</Masters>`);
  zip.file('visio/masters/_rels/masters.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master1.xml"/>
</Relationships>`);
  zip.file('visio/masters/master1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<MasterContents>
  <Shapes>
    <Shape ID="5">
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Section N="Geometry">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="ArcTo" IX="2"><Cell N="X" V="1"/><Cell N="Y" V="1"/><Cell N="A" V="0.25"/></Row>
        <Row T="EllipticalArcTo" IX="3"><Cell N="X" V="2"/><Cell N="Y" V="0"/><Cell N="A" V="1.5"/><Cell N="B" V="1"/></Row>
      </Section>
    </Shape>
  </Shapes>
</MasterContents>`);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Curved" Master="2">
      <Cell N="PinX" V="4"/>
      <Cell N="PinY" V="4"/>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'curved-fixture.vsdx');
  const geometryPath = diagram.pages[0]?.shapes[0]?.geometryPath ?? '';
  assert.ok(geometryPath.includes(' Q '), 'expected curved geometry rows to compile to SVG quadratic curves');
}

async function verifiesAdvancedGeometryRows(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Advanced">
      <Cell N="PinX" V="4"/>
      <Cell N="PinY" V="4"/>
      <Cell N="Width" V="4"/>
      <Cell N="Height" V="2"/>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="RelLineTo" IX="2"><Cell N="X" V="0.25"/><Cell N="Y" V="0.5"/></Row>
        <Row T="RelQuadBezTo" IX="3"><Cell N="X" V="0.5"/><Cell N="Y" V="0.5"/><Cell N="A" V="0.35"/><Cell N="B" V="0.75"/></Row>
        <Row T="RelCubBezTo" IX="4"><Cell N="X" V="0.75"/><Cell N="Y" V="0.25"/><Cell N="A" V="0.55"/><Cell N="B" V="0.75"/><Cell N="C" V="0.65"/><Cell N="D" V="0.25"/></Row>
        <Row T="PolylineTo" IX="5"><Cell N="X" V="4"/><Cell N="Y" V="0"/><Cell N="A" F="POLYLINE(Width-0.5,Height*0.25,Width,0)"/></Row>
      </Section>
      <Section N="Geometry" IX="1">
        <Row T="Ellipse" IX="1"><Cell N="X" V="2"/><Cell N="Y" V="1"/><Cell N="A" V="3"/><Cell N="B" V="1"/><Cell N="C" V="2"/><Cell N="D" V="1.5"/></Row>
      </Section>
      <Section N="Geometry" IX="2">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="1"/></Row>
        <Row T="NURBSTo" IX="2"><Cell N="X" V="4"/><Cell N="Y" V="1"/><Cell N="E" F="NURBS(Width*0.25,Height*0.5,Width*0.5,Height*0.5,Width*0.75,Height*0.5)"/></Row>
      </Section>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'advanced-geometry-fixture.vsdx');
  const geometryPath = diagram.pages[0]?.shapes[0]?.geometryPath ?? '';
  assert.ok(geometryPath.includes(' Q '), 'expected relative quadratic geometry to compile');
  assert.ok(geometryPath.includes(' C '), 'expected relative cubic geometry to compile');
  assert.ok(geometryPath.includes(' A '), 'expected ellipse geometry to compile to SVG arcs');
  assert.ok(geometryPath.includes('L 3.5 1.5'), 'expected polyline formula vertices to be rendered');
}

async function verifiesFormulaGeometryAndMasterRowInheritance(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/masters/masters.xml', `<?xml version="1.0" encoding="UTF-8"?>
<Masters xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Master ID="2" NameU="FormulaMaster"><Rel r:id="rId1"/></Master>
</Masters>`);
  zip.file('visio/masters/_rels/masters.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master1.xml"/>
</Relationships>`);
  zip.file('visio/masters/master1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<MasterContents>
  <Shapes>
    <Shape ID="5">
      <Cell N="Width" V="4"/>
      <Cell N="Height" V="2"/>
      <Section N="Scratch">
        <Row IX="1"><Cell N="Y" V="1" F="Width*0.25"/></Row>
      </Section>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1"><Cell N="X" V="1" F="Scratch.Y1"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="3" F="Width*0.75"/><Cell N="Y" V="1" F="Height*0.5"/></Row>
        <Row T="LineTo" IX="3"><Cell N="X" V="4" F="Width"/><Cell N="Y" V="2" F="Height"/></Row>
      </Section>
    </Shape>
  </Shapes>
</MasterContents>`);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="FormulaMaster" Master="2">
      <Cell N="PinX" V="4"/>
      <Cell N="PinY" V="4"/>
      <Cell N="Width" V="8"/>
      <Cell N="Height" V="4"/>
      <Section N="Geometry" IX="0">
        <Row T="LineTo" IX="2"><Cell N="X" V="6" F="Width*0.75"/></Row>
      </Section>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'formula-inheritance-fixture.vsdx');
  const geometryPath = diagram.pages[0]?.shapes[0]?.geometryPath ?? '';
  assert.strictEqual(geometryPath, 'M 2 4 L 6 2 L 8 0');
}

async function verifiesFormulaOnlyShapeTransformCells(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="FormulaOnlyBox">
      <Cell N="PinX" F="GUARD(ThePage!PageWidth*0.5)"/>
      <Cell N="PinY" F="=2IN"/>
      <Cell N="Width" F="GUARD(2)"/>
      <Cell N="Height" F="Width*0.5"/>
      <Cell N="LineWeight" F="0.04"/>
      <Text>Formula only box</Text>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1"><Cell N="X" F="0"/><Cell N="Y" F="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" F="Width"/><Cell N="Y" F="Height"/></Row>
      </Section>
    </Shape>
    <Shape ID="2" NameU="Dynamic connector">
      <Cell N="BeginX" F="GUARD(1)"/>
      <Cell N="BeginY" F="GUARD(1)"/>
      <Cell N="EndX" F="GUARD(4)"/>
      <Cell N="EndY" F="GUARD(3)"/>
      <Cell N="PinX" F="(BeginX+EndX)/2"/>
      <Cell N="PinY" F="(BeginY+EndY)/2"/>
      <Cell N="Width" F="EndX-BeginX"/>
      <Cell N="Height" F="EndY-BeginY"/>
      <Cell N="EndArrow" F="GUARD(5)"/>
    </Shape>
  </Shapes>
</PageContents>`);

  const sourceBytes = await zip.generateAsync({ type: 'nodebuffer' });
  const diagram = await readVsdxDiagram(sourceBytes, 'formula-only-transform-fixture.vsdx');
  const shape = diagram.pages[0]?.shapes.find(candidate => candidate.id === '1');
  const connector = diagram.pages[0]?.shapes.find(candidate => candidate.id === '2');
  assert.ok(shape?.editable, 'expected formula-only shape transform cells to be editable');
  assert.ok(Math.abs((shape.x ?? 0) - 3.25) < 0.0001, 'expected formula-only shape x to use page width formula');
  assert.ok(Math.abs((shape.y ?? 0) - 1.5) < 0.0001, 'expected formula-only shape y to use unit formula');
  assert.ok(Math.abs((shape.width ?? 0) - 2) < 0.0001, 'expected formula-only shape width');
  assert.ok(Math.abs((shape.height ?? 0) - 1) < 0.0001, 'expected formula-only shape height to use local Width ref');
  assert.ok(Math.abs((shape.strokeWidth ?? 0) - 0.04) < 0.0001, 'expected formula-only line weight');
  assert.strictEqual(shape.geometryPath, 'M 0 1 L 2 0');
  assert.ok(connector?.editable, 'expected formula-only connector endpoints to be editable');
  assert.ok(Math.abs((connector.beginX ?? 0) - 1) < 0.0001, 'expected formula-only connector begin x');
  assert.ok(Math.abs((connector.endY ?? 0) - 3) < 0.0001, 'expected formula-only connector end y');
  assert.strictEqual(connector.endArrow, 5, 'expected formula-only connector arrow');

  const updatedDiagram = replaceShapeInDiagram(diagram, {
    pageEntry: diagram.pages[0].entry,
    shape: {
      ...shape,
      x: 4,
      y: 2,
      width: 3,
      height: 1.5,
      text: 'Updated formula only box'
    }
  });
  const updatedBytes = await writeVsdxDiagram(sourceBytes, updatedDiagram);
  const updatedZip = await JSZip.loadAsync(updatedBytes);
  const pageXml = await updatedZip.file('visio/pages/page1.xml')?.async('text');
  assert.ok(pageXml, 'expected updated formula-only page XML');
  assert.ok(!pageXml.includes('ThePage!PageWidth'), 'expected stale transform formulas to be removed after edit');
  assert.ok(pageXml.includes('<Cell N="PinX" V="5.5"/>'), 'expected edited formula-only PinX to be numeric');
  assert.ok(pageXml.includes('<Cell N="PinY" V="2.75"/>'), 'expected edited formula-only PinY to be numeric');
  assert.ok(pageXml.includes('<Cell N="Width" V="3"/>'), 'expected edited formula-only Width to be numeric');
  assert.ok(pageXml.includes('<Cell N="Height" V="1.5"/>'), 'expected edited formula-only Height to be numeric');
}

async function verifiesTextBoxTransformCells(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="OffsetText">
      <Cell N="PinX" V="3"/>
      <Cell N="PinY" V="3"/>
      <Cell N="Width" V="4"/>
      <Cell N="Height" V="2"/>
      <Cell N="TxtPinX" F="Width*0.75"/>
      <Cell N="TxtPinY" F="Height*0.25"/>
      <Cell N="TxtWidth" F="Width*0.5"/>
      <Cell N="TxtHeight" F="Height*0.5"/>
      <Cell N="TxtLocPinX" F="TxtWidth*0.5"/>
      <Cell N="TxtLocPinY" F="TxtHeight*0.5"/>
      <Cell N="TxtAngle" F="GUARD(0.2)"/>
      <Text>Offset text</Text>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'textbox-transform-fixture.vsdx');
  const shape = diagram.pages[0]?.shapes[0];
  assert.ok(shape, 'expected text box shape to be parsed');
  assert.strictEqual(shape.text, 'Offset text');
  assert.ok(shape.textBox, 'expected text box metadata to be exposed');
  assert.ok(Math.abs((shape.textBox?.x ?? 0) - 2) < 0.0001, 'expected text box local x');
  assert.ok(Math.abs((shape.textBox?.y ?? 0) - 0) < 0.0001, 'expected text box local y');
  assert.ok(Math.abs((shape.textBox?.width ?? 0) - 2) < 0.0001, 'expected text box width');
  assert.ok(Math.abs((shape.textBox?.height ?? 0) - 1) < 0.0001, 'expected text box height');
  assert.ok(Math.abs((shape.textBox?.angle ?? 0) - 0.2) < 0.0001, 'expected text box angle');
}

async function verifiesColorFormulaAndNoPaint(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/masters/masters.xml', `<?xml version="1.0" encoding="UTF-8"?>
<Masters xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Master ID="2" NameU="Styled"><Rel r:id="rId1"/></Master>
</Masters>`);
  zip.file('visio/masters/_rels/masters.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master1.xml"/>
</Relationships>`);
  zip.file('visio/masters/master1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<MasterContents>
  <Shapes>
    <Shape ID="5">
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="FillForegnd" V="0" F="THEMEGUARD(RGB(17,34,51))"/>
      <Cell N="LineColor" V="0" F="RGB(200,16,32)"/>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="2"/><Cell N="Y" V="0"/></Row>
      </Section>
    </Shape>
  </Shapes>
</MasterContents>`);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Styled" Master="2">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="2"/>
    </Shape>
    <Shape ID="2" NameU="NoPaint">
      <Cell N="PinX" V="5"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="FillPattern" V="0"/>
      <Cell N="LinePattern" V="0"/>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'style-fixture.vsdx');
  const styled = diagram.pages[0]?.shapes[0];
  const noPaint = diagram.pages[0]?.shapes[1];
  assert.strictEqual(styled?.fill, '#112233');
  assert.strictEqual(styled?.line, '#c81020');
  assert.strictEqual(noPaint?.fill, 'none');
  assert.strictEqual(noPaint?.line, 'none');
}

async function verifiesPaintTransparencyCells(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Transparent Shape">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="FillForegnd" V="#112233"/>
      <Cell N="FillForegndTrans" V="40"/>
      <Cell N="LineColor" V="#445566"/>
      <Cell N="LineColorTrans" V="75"/>
    </Shape>
    <Shape ID="2" NameU="Transparent Connector" OneD="1">
      <Cell N="BeginX" V="1"/>
      <Cell N="BeginY" V="4"/>
      <Cell N="EndX" V="5"/>
      <Cell N="EndY" V="4"/>
      <Cell N="LineColor" V="#778899"/>
      <Cell N="LineColorTrans" F="GUARD(25)"/>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'paint-transparency-fixture.vsdx');
  const shape = diagram.pages[0]?.shapes[0];
  const connector = diagram.pages[0]?.shapes[1];
  assert.ok(shape, 'expected transparent shape to be parsed');
  assert.ok(connector, 'expected transparent connector to be parsed');
  assert.ok(Math.abs((shape.fillOpacity ?? 0) - 0.6) < 0.0001, 'expected fill transparency to become fill opacity');
  assert.ok(Math.abs((shape.strokeOpacity ?? 0) - 0.25) < 0.0001, 'expected line transparency to become stroke opacity');
  assert.ok(Math.abs((connector.strokeOpacity ?? 0) - 0.75) < 0.0001, 'expected formula line transparency to become connector stroke opacity');
}

async function verifiesFillPatternBackgroundCells(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Pattern Fill">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="FillPattern" F="GUARD(6)"/>
      <Cell N="FillForegnd" V="#112233"/>
      <Cell N="FillForegndTrans" V="20"/>
      <Cell N="FillBkgnd" F="RGB(220,238,255)"/>
      <Cell N="FillBkgndTrans" V="50"/>
    </Shape>
    <Shape ID="2" NameU="Solid Fill">
      <Cell N="PinX" V="5"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="FillPattern" V="1"/>
      <Cell N="FillForegnd" V="#445566"/>
      <Cell N="FillBkgnd" V="#ffffff"/>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'fill-pattern-fixture.vsdx');
  const patterned = diagram.pages[0]?.shapes[0];
  const solid = diagram.pages[0]?.shapes[1];
  assert.strictEqual(patterned?.fillPattern, 6, 'expected fill pattern metadata');
  assert.strictEqual(patterned?.fill, '#112233', 'expected fill foreground color');
  assert.ok(Math.abs((patterned?.fillOpacity ?? 0) - 0.8) < 0.0001, 'expected fill foreground opacity');
  assert.strictEqual(patterned?.fillBackground, '#dceeff', 'expected fill background color');
  assert.ok(Math.abs((patterned?.fillBackgroundOpacity ?? 0) - 0.5) < 0.0001, 'expected fill background opacity');
  assert.strictEqual(solid?.fillBackground, undefined, 'expected solid fill to skip background pattern metadata');
}

async function verifiesShapeLinePatternCells(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Dashed Shape">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="LinePattern" F="GUARD(3)"/>
      <Cell N="LineWeight" V="0.05"/>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'shape-line-pattern-fixture.vsdx');
  const shape = diagram.pages[0]?.shapes[0];
  assert.ok(shape, 'expected dashed shape to be parsed');
  assert.strictEqual(shape.kind, 'shape');
  assert.strictEqual(shape.linePattern, 3, 'expected shape line pattern metadata');
  assert.ok(Math.abs((shape.strokeWidth ?? 0) - 0.05) < 0.0001, 'expected shape line weight metadata');
}

async function verifiesShapeRoundingCells(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Rounded Shape">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="Rounding" F="GUARD(0.18)"/>
    </Shape>
    <Shape ID="2" NameU="Square Shape">
      <Cell N="PinX" V="5"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="Rounding" V="0"/>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'shape-rounding-fixture.vsdx');
  const rounded = diagram.pages[0]?.shapes[0];
  const square = diagram.pages[0]?.shapes[1];
  assert.ok(rounded, 'expected rounded shape to be parsed');
  assert.ok(Math.abs((rounded?.rounding ?? 0) - 0.18) < 0.0001, 'expected formula rounding metadata');
  assert.strictEqual(square?.rounding, 0, 'expected zero rounding metadata to be preserved');
}

async function verifiesShadowStyleCells(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Shadowed Shape">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="ShdwPattern" V="1"/>
      <Cell N="ShdwForegnd" F="RGB(17,34,51)"/>
      <Cell N="ShdwForegndTrans" V="60"/>
      <Cell N="ShapeShdwOffsetX" F="GUARD(0.125)"/>
      <Cell N="ShapeShdwOffsetY" V="-0.2"/>
      <Cell N="ShapeShdwScaleFactor" V="110"/>
    </Shape>
    <Shape ID="2" NameU="Disabled Shadow">
      <Cell N="PinX" V="5"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="ShdwPattern" V="0"/>
      <Cell N="ShdwForegnd" V="#000000"/>
      <Cell N="ShapeShdwOffsetX" V="0.2"/>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'shadow-fixture.vsdx');
  const shadowed = diagram.pages[0]?.shapes[0];
  const disabled = diagram.pages[0]?.shapes[1];
  assert.strictEqual(shadowed?.shadow?.color, '#112233', 'expected direct shadow color to be parsed');
  assert.ok(Math.abs((shadowed?.shadow?.opacity ?? 0) - 0.4) < 0.0001, 'expected shadow transparency to become opacity');
  assert.ok(Math.abs((shadowed?.shadow?.offsetX ?? 0) - 0.125) < 0.0001, 'expected formula shadow offset X');
  assert.ok(Math.abs((shadowed?.shadow?.offsetY ?? 0) - -0.2) < 0.0001, 'expected direct shadow offset Y');
  assert.ok(Math.abs((shadowed?.shadow?.scale ?? 0) - 1.1) < 0.0001, 'expected percent shadow scale factor');
  assert.strictEqual(disabled?.shadow, undefined, 'expected ShdwPattern=0 to disable shadow rendering');
}

async function verifiesTextStyleCells(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Styled Text">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="Color" V="2"/>
      <Cell N="Size" V="18" U="PT"/>
      <Cell N="Style" V="5"/>
      <Cell N="VerticalAlign" V="0"/>
      <Cell N="LeftMargin" V="0.11"/>
      <Cell N="RightMargin" F="GUARD(0.12)"/>
      <Cell N="TopMargin" V="0.13"/>
      <Cell N="BottomMargin" V="0.14"/>
      <Cell N="TextBkgnd" V="#ffeeaa"/>
      <Cell N="TextBkgndTrans" V="25"/>
      <Text>Direct text style</Text>
    </Shape>
    <Shape ID="2" NameU="Character Text">
      <Cell N="PinX" V="5"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Section N="Character" IX="0">
        <Row IX="0"><Cell N="Color" F="RGB(17,34,51)"/><Cell N="Size" V="0.25" U="IN"/><Cell N="Style" F="GUARD(2)"/></Row>
      </Section>
      <Section N="Paragraph" IX="0">
        <Row IX="0"><Cell N="HAlign" V="2"/></Row>
      </Section>
      <Text>Character text style</Text>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'text-style-fixture.vsdx');
  const direct = diagram.pages[0]?.shapes[0];
  const character = diagram.pages[0]?.shapes[1];
  assert.strictEqual(direct?.textStyle?.color, '#ff0000', 'expected direct text color to use Visio indexed color');
  assert.ok(Math.abs((direct?.textStyle?.fontSize ?? 0) - 0.25) < 0.0001, 'expected point text size to be converted to inches');
  assert.strictEqual(direct?.textStyle?.bold, true, 'expected direct text bold style');
  assert.strictEqual(direct?.textStyle?.italic, false, 'expected direct text italic style');
  assert.strictEqual(direct?.textStyle?.underline, true, 'expected direct text underline style');
  assert.strictEqual(direct?.textStyle?.verticalAlign, 'top', 'expected direct text vertical alignment');
  assert.ok(Math.abs((direct?.textStyle?.margins?.left ?? 0) - 0.11) < 0.0001, 'expected direct left text margin');
  assert.ok(Math.abs((direct?.textStyle?.margins?.right ?? 0) - 0.12) < 0.0001, 'expected formula right text margin');
  assert.ok(Math.abs((direct?.textStyle?.margins?.top ?? 0) - 0.13) < 0.0001, 'expected direct top text margin');
  assert.ok(Math.abs((direct?.textStyle?.margins?.bottom ?? 0) - 0.14) < 0.0001, 'expected direct bottom text margin');
  assert.strictEqual(direct?.textStyle?.background, '#ffeeaa', 'expected direct text background to be parsed');
  assert.ok(Math.abs((direct?.textStyle?.backgroundOpacity ?? 0) - 0.75) < 0.0001, 'expected text background transparency to become opacity');
  assert.strictEqual(character?.textStyle?.color, '#112233', 'expected character row text color to be parsed');
  assert.ok(Math.abs((character?.textStyle?.fontSize ?? 0) - 0.25) < 0.0001, 'expected character row text size to be parsed');
  assert.strictEqual(character?.textStyle?.bold, false, 'expected character row bold style');
  assert.strictEqual(character?.textStyle?.italic, true, 'expected character row italic style');
  assert.strictEqual(character?.textStyle?.underline, false, 'expected character row underline style');
  assert.strictEqual(character?.textStyle?.horizontalAlign, 'right', 'expected paragraph row horizontal alignment');
}

async function verifiesStyleSheetInheritanceForShapePaintAndConnectorStyle(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/document.xml', `<?xml version="1.0" encoding="UTF-8"?>
<VisioDocument>
  <StyleSheets>
    <StyleSheet ID="0" NameU="No Style">
      <Cell N="FillForegnd" V="#ffffff"/>
      <Cell N="FillPattern" V="1"/>
      <Cell N="LineColor" V="#000000"/>
      <Cell N="LinePattern" V="1"/>
      <Cell N="LineWeight" V="0.01"/>
      <Cell N="BeginArrow" V="0"/>
      <Cell N="EndArrow" V="0"/>
    </StyleSheet>
    <StyleSheet ID="3" NameU="Base" LineStyle="0" FillStyle="0" TextStyle="0">
      <Cell N="FillForegnd" V="#ddeeff"/>
      <Cell N="LineColor" V="#112233"/>
      <Cell N="LineWeight" V="0.02"/>
      <Cell N="VerticalAlign" V="2"/>
      <Cell N="LeftMargin" V="0.09"/>
      <Cell N="RightMargin" V="0.08"/>
      <Section N="Character" IX="0"><Row IX="0"><Cell N="Style" V="3"/></Row></Section>
      <Section N="Paragraph" IX="0"><Row IX="0"><Cell N="HAlign" V="0"/></Row></Section>
    </StyleSheet>
    <StyleSheet ID="7" NameU="Flow Normal" LineStyle="3" FillStyle="3" TextStyle="3">
      <Cell N="FillForegnd" V="#123456"/>
      <Cell N="FillBkgnd" V="#f6d365"/>
      <Cell N="FillBkgndTrans" V="40"/>
      <Cell N="FillPattern" V="6"/>
      <Cell N="LineColor" V="#654321"/>
      <Cell N="LinePattern" V="2"/>
      <Cell N="LineCap" V="1"/>
      <Cell N="LineWeight" V="0.03"/>
      <Cell N="Rounding" V="0.17"/>
      <Cell N="ShdwPattern" V="1"/>
      <Cell N="ShdwForegnd" V="#222222"/>
      <Cell N="ShdwForegndTrans" V="30"/>
      <Cell N="ShapeShdwOffsetX" V="0.15"/>
      <Cell N="ShapeShdwOffsetY" V="-0.1"/>
      <Cell N="BeginArrow" V="4"/>
      <Cell N="EndArrow" V="13"/>
      <Cell N="BeginArrowSize" V="1"/>
      <Cell N="EndArrowSize" V="4"/>
    </StyleSheet>
    <StyleSheet ID="8" NameU="Connector" LineStyle="7" FillStyle="7" TextStyle="7">
      <Cell N="LineColor" V="#abcdef"/>
      <Cell N="LinePattern" V="3"/>
      <Cell N="LineCap" V="2"/>
      <Cell N="EndArrow" V="5"/>
      <Cell N="EndArrowSize" F="GUARD(3)"/>
      <Cell N="FillForegnd" V="Themed" F="Inh"/>
    </StyleSheet>
  </StyleSheets>
</VisioDocument>`);
  zip.file('visio/masters/masters.xml', `<?xml version="1.0" encoding="UTF-8"?>
<Masters xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Master ID="2" NameU="StyledMaster"><Rel r:id="rId1"/></Master>
</Masters>`);
  zip.file('visio/masters/_rels/masters.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master1.xml"/>
</Relationships>`);
  zip.file('visio/masters/master1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<MasterContents>
  <Shapes>
    <Shape ID="4" LineStyle="7" FillStyle="7" TextStyle="7">
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="2"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="3"><Cell N="X" V="2"/><Cell N="Y" V="1"/></Row>
      </Section>
    </Shape>
  </Shapes>
</MasterContents>`);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="DirectStyle" LineStyle="7" FillStyle="7" TextStyle="7">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Text>Styled text</Text>
    </Shape>
    <Shape ID="2" NameU="MasterStyle" Master="2">
      <Cell N="PinX" V="5"/>
      <Cell N="PinY" V="2"/>
    </Shape>
    <Shape ID="3" NameU="Dynamic connector" OneD="1" LineStyle="8" FillStyle="8" TextStyle="8">
      <Cell N="BeginX" V="1"/>
      <Cell N="BeginY" V="4"/>
      <Cell N="EndX" V="5"/>
      <Cell N="EndY" V="4"/>
      <Cell N="PinX" V="3"/>
      <Cell N="PinY" V="4"/>
      <Cell N="Width" V="4"/>
      <Cell N="Height" V="0"/>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'stylesheet-fixture.vsdx');
  const direct = diagram.pages[0]?.shapes.find(shape => shape.id === '1');
  const inheritedFromMaster = diagram.pages[0]?.shapes.find(shape => shape.id === '2');
  const connector = diagram.pages[0]?.shapes.find(shape => shape.id === '3');
  assert.strictEqual(direct?.fill, '#123456', 'expected page shape fill to inherit from FillStyle');
  assert.strictEqual(direct?.fillPattern, 6, 'expected page shape fill pattern to inherit from FillStyle');
  assert.strictEqual(direct?.fillBackground, '#f6d365', 'expected page shape fill background to inherit from FillStyle');
  assert.ok(Math.abs((direct?.fillBackgroundOpacity ?? 0) - 0.6) < 0.0001, 'expected page shape fill background opacity to inherit from FillStyle');
  assert.strictEqual(direct?.line, '#654321', 'expected page shape line to inherit from LineStyle');
  assert.strictEqual(direct?.textStyle?.bold, true, 'expected page shape bold text style to inherit from TextStyle');
  assert.strictEqual(direct?.textStyle?.italic, true, 'expected page shape italic text style to inherit from TextStyle');
  assert.strictEqual(direct?.textStyle?.underline, false, 'expected page shape underline text style to inherit from TextStyle');
  assert.strictEqual(direct?.textStyle?.horizontalAlign, 'left', 'expected page shape horizontal text alignment to inherit from TextStyle');
  assert.strictEqual(direct?.textStyle?.verticalAlign, 'bottom', 'expected page shape vertical text alignment to inherit from TextStyle');
  assert.ok(Math.abs((direct?.textStyle?.margins?.left ?? 0) - 0.09) < 0.0001, 'expected page shape left margin to inherit from TextStyle');
  assert.ok(Math.abs((direct?.textStyle?.margins?.right ?? 0) - 0.08) < 0.0001, 'expected page shape right margin to inherit from TextStyle');
  assert.strictEqual(direct?.linePattern, 2, 'expected page shape line pattern to inherit from LineStyle');
  assert.strictEqual(direct?.lineCap, 1, 'expected page shape line cap to inherit from LineStyle');
  assert.ok(Math.abs((direct?.rounding ?? 0) - 0.17) < 0.0001, 'expected page shape rounding to inherit from LineStyle');
  assert.strictEqual(direct?.shadow?.color, '#222222', 'expected page shape shadow color to inherit from FillStyle');
  assert.ok(Math.abs((direct?.shadow?.opacity ?? 0) - 0.7) < 0.0001, 'expected page shape shadow opacity to inherit from FillStyle');
  assert.ok(Math.abs((direct?.shadow?.offsetX ?? 0) - 0.15) < 0.0001, 'expected page shape shadow offset X to inherit from FillStyle');
  assert.ok(Math.abs((direct?.shadow?.offsetY ?? 0) - -0.1) < 0.0001, 'expected page shape shadow offset Y to inherit from FillStyle');
  assert.ok(Math.abs((direct?.strokeWidth ?? 0) - 0.03) < 0.0001, 'expected page shape stroke width to inherit from LineStyle');
  assert.strictEqual(inheritedFromMaster?.fill, '#123456', 'expected master style fill to reach page instance');
  assert.strictEqual(inheritedFromMaster?.fillBackground, '#f6d365', 'expected master style fill background to reach page instance');
  assert.strictEqual(inheritedFromMaster?.line, '#654321', 'expected master style line to reach page instance');
  assert.ok(Math.abs((inheritedFromMaster?.rounding ?? 0) - 0.17) < 0.0001, 'expected master style rounding to reach page instance');
  assert.strictEqual(inheritedFromMaster?.shadow?.color, '#222222', 'expected master style shadow to reach page instance');
  assert.strictEqual(inheritedFromMaster?.width, 2, 'expected master width to remain available through effective cells');
  assert.strictEqual(inheritedFromMaster?.height, 1, 'expected master height to remain available through effective cells');
  assert.strictEqual(connector?.kind, 'connector');
  assert.strictEqual(connector?.line, '#abcdef', 'expected connector line color to inherit from connector LineStyle');
  assert.strictEqual(connector?.linePattern, 3, 'expected connector line pattern to inherit from connector LineStyle');
  assert.strictEqual(connector?.lineCap, 2, 'expected connector line cap to inherit from connector LineStyle');
  assert.strictEqual(connector?.endArrow, 5, 'expected connector end arrow to inherit from connector LineStyle');
  assert.strictEqual(connector?.beginArrowSize, 1, 'expected connector begin arrow size to inherit from parent LineStyle');
  assert.strictEqual(connector?.endArrowSize, 3, 'expected connector end arrow size formula to inherit from connector LineStyle');
  assert.strictEqual(connector?.fill, '#123456', 'expected inherited FillStyle fallback when connector style fill is Inh');
}

async function verifiesMasterChildShapeExpansion(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/masters/masters.xml', `<?xml version="1.0" encoding="UTF-8"?>
<Masters xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Master ID="2" NameU="Composite"><Rel r:id="rId1"/></Master>
</Masters>`);
  zip.file('visio/masters/_rels/masters.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master1.xml"/>
</Relationships>`);
  zip.file('visio/masters/master1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<MasterContents>
  <Shapes>
    <Shape ID="5">
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="PinX" V="1"/>
      <Cell N="PinY" V="0.5"/>
      <Cell N="LocPinX" V="1"/>
      <Cell N="LocPinY" V="0.5"/>
      <Shapes>
        <Shape ID="7" NameU="InnerLabel">
          <Cell N="PinX" V="0.5"/>
          <Cell N="PinY" V="0.5"/>
          <Cell N="Width" V="0.5"/>
          <Cell N="Height" V="0.25"/>
          <Text>Inner</Text>
          <Section N="Geometry" IX="0">
            <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
            <Row T="LineTo" IX="2"><Cell N="X" V="0.5"/><Cell N="Y" V="0"/></Row>
            <Row T="LineTo" IX="3"><Cell N="X" V="0.5"/><Cell N="Y" V="0.25"/></Row>
          </Section>
        </Shape>
      </Shapes>
    </Shape>
  </Shapes>
</MasterContents>`);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Composite" Master="2">
      <Cell N="PinX" V="5"/>
      <Cell N="PinY" V="5"/>
      <Cell N="Width" V="4"/>
      <Cell N="Height" V="2"/>
      <Cell N="LocPinX" V="2"/>
      <Cell N="LocPinY" V="1"/>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'master-child-fixture.vsdx');
  const child = diagram.pages[0]?.shapes.find(shape => shape.id === '1/master/7');
  assert.ok(child, 'expected inherited master child shape to be expanded');
  assert.strictEqual(child.text, 'Inner');
  assert.strictEqual(child.editable, false);
  assert.ok(child.reason?.includes('Inherited master sub-shape'), 'expected virtual master child to be read-only');
  assert.ok(Math.abs((child.x ?? 0) - 3.5) < 0.0001, 'expected child x to be scaled into page coordinates');
  assert.ok(Math.abs((child.y ?? 0) - 4.75) < 0.0001, 'expected child y to be scaled into page coordinates');
  assert.ok(Math.abs((child.width ?? 0) - 1) < 0.0001, 'expected child width to be scaled');
  assert.ok(Math.abs((child.height ?? 0) - 0.5) < 0.0001, 'expected child height to be scaled');
}

async function verifiesMultiRootMasterShapeExpansion(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/masters/masters.xml', `<?xml version="1.0" encoding="UTF-8"?>
<Masters xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Master ID="12" NameU="MultiRoot"><Rel r:id="rId1"/></Master>
</Masters>`);
  zip.file('visio/masters/_rels/masters.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master1.xml"/>
</Relationships>`);
  zip.file('visio/masters/master1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<MasterContents>
  <Shapes>
    <Shape ID="5" NameU="Base">
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="2"/><Cell N="Y" V="1"/></Row>
      </Section>
    </Shape>
    <Shape ID="6" NameU="Badge">
      <Cell N="PinX" V="1.5"/>
      <Cell N="PinY" V="0.75"/>
      <Cell N="Width" V="0.4"/>
      <Cell N="Height" V="0.2"/>
      <Text>Badge</Text>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="0.4"/><Cell N="Y" V="0.2"/></Row>
      </Section>
    </Shape>
  </Shapes>
</MasterContents>`);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="MultiRoot" Master="12">
      <Cell N="PinX" V="5"/>
      <Cell N="PinY" V="4"/>
      <Cell N="Width" V="4"/>
      <Cell N="Height" V="2"/>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'multi-root-master-fixture.vsdx');
  const base = diagram.pages[0]?.shapes.find(shape => shape.id === '1');
  const badge = diagram.pages[0]?.shapes.find(shape => shape.id === '1/master/6');
  assert.ok(base, 'expected master instance base shape to be parsed');
  assert.ok(badge, 'expected second top-level master shape to be expanded');
  assert.strictEqual(badge.text, 'Badge');
  assert.strictEqual(badge.editable, false);
  assert.ok(Math.abs((badge.x ?? 0) - 5.6) < 0.0001, 'expected multi-root badge x to scale into page coordinates');
  assert.ok(Math.abs((badge.y ?? 0) - 4.3) < 0.0001, 'expected multi-root badge y to scale into page coordinates');
  assert.ok(Math.abs((badge.width ?? 0) - 0.8) < 0.0001, 'expected multi-root badge width to scale');
  assert.ok(Math.abs((badge.height ?? 0) - 0.4) < 0.0001, 'expected multi-root badge height to scale');
}

async function verifiesRichTextWriteBackPreservesFormattingMarkers(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="RichText">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Text><cp IX="0"/><pp IX="0"/><tp IX="0"/>Old formatted text</Text>
    </Shape>
  </Shapes>
</PageContents>`);

  const sourceBytes = await zip.generateAsync({ type: 'nodebuffer' });
  const diagram = await readVsdxDiagram(sourceBytes, 'rich-text-writeback-fixture.vsdx');
  const shape = diagram.pages[0]?.shapes[0];
  assert.ok(shape, 'expected rich text shape to be parsed');
  assert.strictEqual(shape.text, 'Old formatted text');

  const nextText = 'New <formatted> & checked';
  const updatedDiagram = replaceShapeInDiagram(diagram, {
    pageEntry: diagram.pages[0].entry,
    shape: {
      ...shape,
      text: nextText
    }
  });
  const updatedBytes = await writeVsdxDiagram(sourceBytes, updatedDiagram);
  const updatedZip = await JSZip.loadAsync(updatedBytes);
  const pageXml = await updatedZip.file('visio/pages/page1.xml')?.async('text');
  assert.ok(pageXml, 'expected updated page XML');
  assert.strictEqual(countXmlDeclarations(pageXml), 1, 'expected updated modern page XML to contain one XML declaration');
  assert.ok(pageXml.includes('<cp IX="0"'), 'expected character formatting marker to remain');
  assert.ok(pageXml.includes('<pp IX="0"'), 'expected paragraph formatting marker to remain');
  assert.ok(pageXml.includes('<tp IX="0"'), 'expected tab formatting marker to remain');
  assert.ok(pageXml.includes('New &lt;formatted&gt; &amp; checked'), 'expected edited text to be escaped');
  assert.ok(!pageXml.includes('Old formatted text'), 'expected old text payload to be removed');
}

async function verifiesConnectorWriteBackSynchronizesGeometry(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Dynamic connector">
      <Cell N="PinX" V="2" F="GUARD(2)"/>
      <Cell N="PinY" V="2" F="GUARD(2)"/>
      <Cell N="Width" V="3" F="GUARD(3)"/>
      <Cell N="Height" V="2" F="GUARD(2)"/>
      <Cell N="BeginX" V="1" F="GUARD(1)"/>
      <Cell N="BeginY" V="1" F="GUARD(1)"/>
      <Cell N="EndX" V="4" F="GUARD(4)"/>
      <Cell N="EndY" V="3" F="GUARD(3)"/>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="3"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="3"><Cell N="X" V="3"/><Cell N="Y" V="2"/></Row>
      </Section>
    </Shape>
  </Shapes>
</PageContents>`);

  const sourceBytes = await zip.generateAsync({ type: 'nodebuffer' });
  const diagram = await readVsdxDiagram(sourceBytes, 'connector-writeback-fixture.vsdx');
  const connector = diagram.pages[0]?.shapes[0];
  assert.ok(connector, 'expected connector to be parsed before write-back');

  const updatedDiagram = replaceShapeInDiagram(diagram, {
    pageEntry: diagram.pages[0].entry,
    shape: {
      ...connector,
      beginX: 1,
      beginY: 1,
      endX: 5,
      endY: 3,
      text: 'Updated connector'
    }
  });
  const updatedBytes = await writeVsdxDiagram(sourceBytes, updatedDiagram);
  const updatedZip = await JSZip.loadAsync(updatedBytes);
  const pageXml = await updatedZip.file('visio/pages/page1.xml')?.async('text');
  assert.ok(pageXml, 'expected updated page XML for connector write-back');
  assert.ok(!pageXml.includes('GUARD('), 'expected edited connector cells to drop stale formulas');
  assert.ok(!pageXml.includes('IX="3"'), 'expected stale connector bend row to be removed');

  const reread = await readVsdxDiagram(updatedBytes, 'connector-writeback-fixture.vsdx');
  const rereadConnector = reread.pages[0]?.shapes[0];
  assert.strictEqual(rereadConnector?.kind, 'connector');
  assert.strictEqual(rereadConnector?.geometryPath, 'M 0 2 L 4 0');
  assert.ok(Math.abs((rereadConnector?.x ?? 0) - 1) < 0.0001, 'expected connector bbox left to match new endpoints');
  assert.ok(Math.abs((rereadConnector?.y ?? 0) - 1) < 0.0001, 'expected connector bbox bottom to match new endpoints');
  assert.ok(Math.abs((rereadConnector?.width ?? 0) - 4) < 0.0001, 'expected connector width to match new endpoints');
  assert.ok(Math.abs((rereadConnector?.height ?? 0) - 2) < 0.0001, 'expected connector height to match new endpoints');
}

async function verifiesStencilMasterFallbackPreview(): Promise<void> {
  const zip = new JSZip();
  zip.file('visio/masters/masters.xml', `<?xml version="1.0" encoding="UTF-8"?>
<Masters xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Master ID="2" NameU="StencilShape"><Rel r:id="rId1"/></Master>
</Masters>`);
  zip.file('visio/masters/_rels/masters.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master1.xml"/>
</Relationships>`);
  zip.file('visio/masters/master1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<MasterContents>
  <Shapes>
    <Shape ID="5">
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Text>Stencil master</Text>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="2"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="3"><Cell N="X" V="2"/><Cell N="Y" V="1"/></Row>
      </Section>
    </Shape>
  </Shapes>
</MasterContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'stencil-fixture.vssx');
  assert.strictEqual(diagram.formatSupport, 'modern-package');
  assert.strictEqual(diagram.pages.length, 1, 'expected stencil master to render as a preview page');
  assert.ok(diagram.pages[0].entry.startsWith('__master__'), 'expected synthetic master preview page');
  const shape = diagram.pages[0].shapes[0];
  assert.ok(shape, 'expected stencil master shape to be exposed');
  assert.strictEqual(shape.editable, false);
  assert.ok(shape.geometryPath?.startsWith('M 0 1 L 2 1'), 'expected stencil master geometry to be rendered');
}

async function verifiesLegacyVisioBinaryGetsReadOnlyDiagram(): Promise<void> {
  const sourceBytes = Buffer.from('legacy visio binary placeholder');
  const diagram = await readVsdxDiagram(sourceBytes, 'legacy-fixture.vsd');
  assert.strictEqual(diagram.formatSupport, 'legacy-binary');
  assert.strictEqual(diagram.pages.length, 1, 'expected legacy binary to produce a read-only explanation page');
  assert.strictEqual(diagram.pages[0].shapes[0]?.editable, false);
  assert.ok(diagram.readOnlyReason?.includes('Convert this file to a modern Visio package'));
  const writtenBytes = await writeVsdxDiagram(sourceBytes, diagram);
  assert.strictEqual(Buffer.compare(sourceBytes, writtenBytes), 0, 'expected legacy binary save to preserve original bytes');
}

async function verifiesLegacyOpaqueVisioGetsReadOnlyDiagram(): Promise<void> {
  const sourceBytes = Buffer.from('legacy web drawing placeholder');
  const diagram = await readVsdxDiagram(sourceBytes, 'legacy-web-fixture.vdw');
  assert.strictEqual(diagram.formatSupport, 'legacy-opaque');
  assert.strictEqual(diagram.pages.length, 1, 'expected opaque legacy format to produce a read-only explanation page');
  assert.strictEqual(diagram.pages[0].shapes[0]?.editable, false);
  assert.ok(diagram.readOnlyReason?.includes('Convert it to a modern Visio package'));
  const writtenBytes = await writeVsdxDiagram(sourceBytes, diagram);
  assert.strictEqual(Buffer.compare(sourceBytes, writtenBytes), 0, 'expected opaque legacy save to preserve original bytes');
}

async function verifiesLegacyXmlDrawingPreviewAndWriteBack(): Promise<void> {
  const source = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<VisioDocument>
  <Pages>
    <Page ID="1" Name="Legacy XML Page">
      <PageSheet>
        <PageProps>
          <PageWidth>8.5</PageWidth>
          <PageHeight>6</PageHeight>
        </PageProps>
      </PageSheet>
      <Shapes>
        <Shape ID="10" NameU="Rectangle">
          <XForm>
            <PinX>2</PinX>
            <PinY>2</PinY>
            <Width>2</Width>
            <Height>1</Height>
            <LocPinX>1</LocPinX>
            <LocPinY>0.5</LocPinY>
          </XForm>
          <Line><LinePattern>2</LinePattern><LineCap>2</LineCap><Rounding>0.19</Rounding><BeginArrowSize>1</BeginArrowSize><EndArrowSize>4</EndArrowSize></Line>
          <Fill>
            <FillPattern>7</FillPattern>
            <FillForegnd>#aa5500</FillForegnd>
            <FillForegndTrans>10</FillForegndTrans>
            <FillBkgnd>RGB(250,240,210)</FillBkgnd>
            <FillBkgndTrans>30</FillBkgndTrans>
            <ShdwPattern>1</ShdwPattern>
            <ShdwForegnd>RGB(10,20,30)</ShdwForegnd>
            <ShdwForegndTrans>25</ShdwForegndTrans>
            <ShapeShdwOffsetX>0.2</ShapeShdwOffsetX>
            <ShapeShdwOffsetY>-0.1</ShapeShdwOffsetY>
            <ShapeShdwScaleFactor>1.05</ShapeShdwScaleFactor>
          </Fill>
          <TextXForm>
            <TxtPinX>1.5</TxtPinX>
            <TxtPinY>0.25</TxtPinY>
            <TxtWidth>1</TxtWidth>
            <TxtHeight>0.5</TxtHeight>
            <TxtLocPinX>0.5</TxtLocPinX>
            <TxtLocPinY>0.25</TxtLocPinY>
          </TextXForm>
          <TextBlock>
            <TextBkgnd>#ddeeff</TextBkgnd>
            <TextBkgndTrans>50</TextBkgndTrans>
            <VerticalAlign>2</VerticalAlign>
            <LeftMargin>0.03</LeftMargin>
            <RightMargin>0.04</RightMargin>
            <TopMargin>0.05</TopMargin>
            <BottomMargin>0.06</BottomMargin>
          </TextBlock>
          <Para IX="0">
            <HAlign>2</HAlign>
          </Para>
          <Char IX="0">
            <Color>RGB(68,85,102)</Color>
            <Size U="PT">14</Size>
            <Style>7</Style>
          </Char>
          <Text>Legacy text</Text>
          <Geom IX="0">
            <MoveTo IX="1"><X>0</X><Y>0</Y></MoveTo>
            <LineTo IX="2"><X>2</X><Y>0</Y></LineTo>
            <LineTo IX="3"><X>2</X><Y>1</Y></LineTo>
            <LineTo IX="4"><X>0</X><Y>1</Y></LineTo>
            <LineTo IX="5"><X>0</X><Y>0</Y></LineTo>
          </Geom>
        </Shape>
        <Shape ID="11" NameU="Dynamic connector" OneD="1">
          <XForm1D>
            <BeginX>3</BeginX>
            <BeginY>2</BeginY>
            <EndX>5</EndX>
            <EndY>4</EndY>
          </XForm1D>
        </Shape>
      </Shapes>
    </Page>
  </Pages>
</VisioDocument>`, 'utf8');

  const diagram = await readVsdxDiagram(source, 'legacy-xml-fixture.vdx');
  assert.strictEqual(diagram.formatSupport, 'legacy-xml');
  assert.strictEqual(diagram.pages.length, 1, 'expected legacy XML page to be parsed');
  const shape = diagram.pages[0]?.shapes.find(candidate => candidate.id === '10');
  assert.ok(shape, 'expected legacy XML shape');
  assert.strictEqual(shape.editable, true);
  assert.strictEqual(shape.text, 'Legacy text');
  assert.strictEqual(shape.lineCap, 2, 'expected legacy XML direct line cap metadata');
  assert.strictEqual(shape.linePattern, 2, 'expected legacy XML direct line pattern metadata');
  assert.ok(Math.abs((shape.rounding ?? 0) - 0.19) < 0.0001, 'expected legacy XML direct rounding metadata');
  assert.strictEqual(shape.fillPattern, 7, 'expected legacy XML direct fill pattern metadata');
  assert.strictEqual(shape.fill, '#aa5500', 'expected legacy XML direct fill foreground metadata');
  assert.ok(Math.abs((shape.fillOpacity ?? 0) - 0.9) < 0.0001, 'expected legacy XML direct fill foreground opacity metadata');
  assert.strictEqual(shape.fillBackground, '#faf0d2', 'expected legacy XML direct fill background metadata');
  assert.ok(Math.abs((shape.fillBackgroundOpacity ?? 0) - 0.7) < 0.0001, 'expected legacy XML direct fill background opacity metadata');
  assert.strictEqual(shape.beginArrowSize, 1, 'expected legacy XML direct begin arrow size metadata');
  assert.strictEqual(shape.endArrowSize, 4, 'expected legacy XML direct end arrow size metadata');
  assert.strictEqual(shape.shadow?.color, '#0a141e', 'expected legacy XML direct shadow color metadata');
  assert.ok(Math.abs((shape.shadow?.opacity ?? 0) - 0.75) < 0.0001, 'expected legacy XML direct shadow opacity metadata');
  assert.ok(Math.abs((shape.shadow?.offsetX ?? 0) - 0.2) < 0.0001, 'expected legacy XML direct shadow offset X metadata');
  assert.ok(Math.abs((shape.shadow?.offsetY ?? 0) - -0.1) < 0.0001, 'expected legacy XML direct shadow offset Y metadata');
  assert.ok(Math.abs((shape.shadow?.scale ?? 0) - 1.05) < 0.0001, 'expected legacy XML direct shadow scale metadata');
  assert.ok(shape.textBox, 'expected legacy XML text box metadata');
  assert.strictEqual(shape.textStyle?.color, '#445566', 'expected legacy XML text color metadata');
  assert.ok(Math.abs((shape.textStyle?.fontSize ?? 0) - (14 / 72)) < 0.0001, 'expected legacy XML text size metadata');
  assert.strictEqual(shape.textStyle?.bold, true, 'expected legacy XML text bold metadata');
  assert.strictEqual(shape.textStyle?.italic, true, 'expected legacy XML text italic metadata');
  assert.strictEqual(shape.textStyle?.underline, true, 'expected legacy XML text underline metadata');
  assert.strictEqual(shape.textStyle?.horizontalAlign, 'right', 'expected legacy XML text horizontal alignment metadata');
  assert.strictEqual(shape.textStyle?.verticalAlign, 'bottom', 'expected legacy XML text vertical alignment metadata');
  assert.ok(Math.abs((shape.textStyle?.margins?.left ?? 0) - 0.03) < 0.0001, 'expected legacy XML left text margin metadata');
  assert.ok(Math.abs((shape.textStyle?.margins?.right ?? 0) - 0.04) < 0.0001, 'expected legacy XML right text margin metadata');
  assert.ok(Math.abs((shape.textStyle?.margins?.top ?? 0) - 0.05) < 0.0001, 'expected legacy XML top text margin metadata');
  assert.ok(Math.abs((shape.textStyle?.margins?.bottom ?? 0) - 0.06) < 0.0001, 'expected legacy XML bottom text margin metadata');
  assert.strictEqual(shape.textStyle?.background, '#ddeeff', 'expected legacy XML text background metadata');
  assert.ok(Math.abs((shape.textStyle?.backgroundOpacity ?? 0) - 0.5) < 0.0001, 'expected legacy XML text background transparency metadata');
  assert.ok(Math.abs((shape.textBox?.x ?? 0) - 1) < 0.0001, 'expected legacy XML text box x');
  assert.ok(Math.abs((shape.textBox?.width ?? 0) - 1) < 0.0001, 'expected legacy XML text box width');
  assert.ok(shape.geometryPath?.startsWith('M 0 1 L 2 1'), 'expected legacy XML geometry to render');

  const connector = diagram.pages[0]?.shapes.find(candidate => candidate.id === '11');
  assert.ok(connector, 'expected legacy XML connector');
  assert.strictEqual(connector.kind, 'connector');
  assert.strictEqual(connector.editable, true);

  const updated = replaceShapeInDiagram(replaceShapeInDiagram(diagram, {
    pageEntry: diagram.pages[0].entry,
    shape: {
      ...shape,
      x: 2.5,
      y: 2.5,
      width: 3,
      height: 1.5,
      text: 'Updated legacy XML'
    }
  }), {
    pageEntry: diagram.pages[0].entry,
    shape: {
      ...connector,
      endX: 6,
      endY: 4,
      text: 'Moved connector'
    }
  });

  const updatedBytes = await writeVsdxDiagram(source, updated);
  assert.strictEqual(countXmlDeclarations(updatedBytes.toString('utf8')), 1, 'expected legacy XML write-back to contain one XML declaration');
  const reread = await readVsdxDiagram(updatedBytes, 'legacy-xml-fixture.vdx');
  const rereadShape = reread.pages[0]?.shapes.find(candidate => candidate.id === '10');
  const rereadConnector = reread.pages[0]?.shapes.find(candidate => candidate.id === '11');
  assert.strictEqual(rereadShape?.text, 'Updated legacy XML');
  assert.ok(Math.abs((rereadShape?.x ?? 0) - 2.5) < 0.0001, 'expected legacy XML shape x to write back');
  assert.ok(Math.abs((rereadShape?.y ?? 0) - 2.5) < 0.0001, 'expected legacy XML shape y to write back');
  assert.ok(Math.abs((rereadShape?.width ?? 0) - 3) < 0.0001, 'expected legacy XML shape width to write back');
  assert.ok(Math.abs((rereadShape?.height ?? 0) - 1.5) < 0.0001, 'expected legacy XML shape height to write back');
  assert.strictEqual(rereadConnector?.text, 'Moved connector');
  assert.ok(Math.abs((rereadConnector?.endX ?? 0) - 6) < 0.0001, 'expected legacy XML connector endpoint to write back');
}

async function verifiesLegacyXmlStyleSheetInheritance(): Promise<void> {
  const source = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<VisioDocument>
  <StyleSheets>
    <StyleSheet ID="0" NameU="No Style">
      <Cell N="FillForegnd" V="#ffffff"/>
      <Cell N="FillPattern" V="1"/>
      <Cell N="LineColor" V="#000000"/>
      <Cell N="LinePattern" V="1"/>
    </StyleSheet>
    <StyleSheet ID="5" NameU="Legacy Style" LineStyle="0" FillStyle="0" TextStyle="0">
      <Cell N="FillForegnd" V="#224466"/>
      <Cell N="FillBkgnd" V="#ddeeff"/>
      <Cell N="FillBkgndTrans" V="25"/>
      <Cell N="FillPattern" V="5"/>
      <Cell N="LineColor" V="#6688aa"/>
      <Cell N="LinePattern" V="2"/>
      <Cell N="LineCap" V="1"/>
      <Cell N="Rounding" V="0.16"/>
      <Cell N="BeginArrowSize" V="2"/>
      <Cell N="EndArrowSize" V="4"/>
      <Cell N="LineWeight" V="0.04"/>
      <Cell N="ShdwPattern" V="1"/>
      <Cell N="ShdwForegnd" V="#101820"/>
      <Cell N="ShdwForegndTrans" V="45"/>
      <Cell N="ShapeShdwOffsetX" V="0.08"/>
      <Cell N="ShapeShdwOffsetY" V="-0.12"/>
      <Cell N="TextBkgnd" V="#f0f0f0"/>
      <Cell N="TextBkgndTrans" V="20"/>
      <Cell N="VerticalAlign" V="0"/>
      <Cell N="TopMargin" V="0.07"/>
      <Cell N="BottomMargin" V="0.08"/>
      <Section N="Character" IX="0"><Row IX="0"><Cell N="Color" V="#123456"/><Cell N="Size" V="16" U="PT"/><Cell N="Style" V="4"/></Row></Section>
      <Section N="Paragraph" IX="0"><Row IX="0"><Cell N="HAlign" V="1"/></Row></Section>
    </StyleSheet>
  </StyleSheets>
  <Pages>
    <Page ID="1" Name="Legacy XML Styled">
      <PageSheet><PageProps><PageWidth>8</PageWidth><PageHeight>6</PageHeight></PageProps></PageSheet>
      <Shapes>
        <Shape ID="1" NameU="StyledLegacy" LineStyle="5" FillStyle="5" TextStyle="5">
          <XForm>
            <PinX>2</PinX>
            <PinY>2</PinY>
            <Width>2</Width>
            <Height>1</Height>
          </XForm>
          <Geom IX="0">
            <MoveTo IX="1"><X>0</X><Y>0</Y></MoveTo>
            <LineTo IX="2"><X>2</X><Y>0</Y></LineTo>
          </Geom>
        </Shape>
      </Shapes>
    </Page>
  </Pages>
</VisioDocument>`, 'utf8');

  const diagram = await readVsdxDiagram(source, 'legacy-stylesheet-fixture.vdx');
  const shape = diagram.pages[0]?.shapes[0];
  assert.strictEqual(shape?.fill, '#224466', 'expected legacy XML FillStyle to be applied');
  assert.strictEqual(shape?.fillPattern, 5, 'expected legacy XML FillStyle fill pattern to be applied');
  assert.strictEqual(shape?.fillBackground, '#ddeeff', 'expected legacy XML FillStyle fill background to be applied');
  assert.ok(Math.abs((shape?.fillBackgroundOpacity ?? 0) - 0.75) < 0.0001, 'expected legacy XML FillStyle fill background opacity to be applied');
  assert.strictEqual(shape?.line, '#6688aa', 'expected legacy XML LineStyle to be applied');
  assert.strictEqual(shape?.linePattern, 2, 'expected legacy XML line pattern to be applied');
  assert.strictEqual(shape?.lineCap, 1, 'expected legacy XML line cap to be applied');
  assert.ok(Math.abs((shape?.rounding ?? 0) - 0.16) < 0.0001, 'expected legacy XML line rounding to be applied');
  assert.strictEqual(shape?.beginArrowSize, 2, 'expected legacy XML begin arrow size to be applied');
  assert.strictEqual(shape?.endArrowSize, 4, 'expected legacy XML end arrow size to be applied');
  assert.strictEqual(shape?.shadow?.color, '#101820', 'expected legacy XML FillStyle shadow color to be applied');
  assert.ok(Math.abs((shape?.shadow?.opacity ?? 0) - 0.55) < 0.0001, 'expected legacy XML FillStyle shadow opacity to be applied');
  assert.ok(Math.abs((shape?.shadow?.offsetX ?? 0) - 0.08) < 0.0001, 'expected legacy XML FillStyle shadow offset X to be applied');
  assert.ok(Math.abs((shape?.shadow?.offsetY ?? 0) - -0.12) < 0.0001, 'expected legacy XML FillStyle shadow offset Y to be applied');
  assert.ok(Math.abs((shape?.strokeWidth ?? 0) - 0.04) < 0.0001, 'expected legacy XML line weight to be applied');
  assert.strictEqual(shape?.textStyle?.color, '#123456', 'expected legacy XML TextStyle color to be applied');
  assert.ok(Math.abs((shape?.textStyle?.fontSize ?? 0) - (16 / 72)) < 0.0001, 'expected legacy XML TextStyle size to be applied');
  assert.strictEqual(shape?.textStyle?.bold, false, 'expected legacy XML TextStyle bold to be applied');
  assert.strictEqual(shape?.textStyle?.italic, false, 'expected legacy XML TextStyle italic to be applied');
  assert.strictEqual(shape?.textStyle?.underline, true, 'expected legacy XML TextStyle underline to be applied');
  assert.strictEqual(shape?.textStyle?.horizontalAlign, 'center', 'expected legacy XML TextStyle horizontal alignment to be applied');
  assert.strictEqual(shape?.textStyle?.verticalAlign, 'top', 'expected legacy XML TextStyle vertical alignment to be applied');
  assert.ok(Math.abs((shape?.textStyle?.margins?.top ?? 0) - 0.07) < 0.0001, 'expected legacy XML TextStyle top margin to be applied');
  assert.ok(Math.abs((shape?.textStyle?.margins?.bottom ?? 0) - 0.08) < 0.0001, 'expected legacy XML TextStyle bottom margin to be applied');
  assert.strictEqual(shape?.textStyle?.background, '#f0f0f0', 'expected legacy XML TextStyle background to be applied');
  assert.ok(Math.abs((shape?.textStyle?.backgroundOpacity ?? 0) - 0.8) < 0.0001, 'expected legacy XML TextStyle background opacity to be applied');
}

async function verifiesLegacyXmlStencilFallbackPreview(): Promise<void> {
  const source = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<VisioDocument>
  <Masters>
    <Master ID="7" NameU="LegacyStencil">
      <Shapes>
        <Shape ID="3" NameU="StencilBox">
          <XForm>
            <PinX>1</PinX>
            <PinY>0.5</PinY>
            <Width>2</Width>
            <Height>1</Height>
            <LocPinX>1</LocPinX>
            <LocPinY>0.5</LocPinY>
          </XForm>
          <Text>Legacy stencil</Text>
          <Geom IX="0">
            <MoveTo IX="1"><X>0</X><Y>0</Y></MoveTo>
            <LineTo IX="2"><X>2</X><Y>0</Y></LineTo>
            <LineTo IX="3"><X>2</X><Y>1</Y></LineTo>
          </Geom>
        </Shape>
      </Shapes>
    </Master>
  </Masters>
</VisioDocument>`, 'utf8');

  const diagram = await readVsdxDiagram(source, 'legacy-stencil-fixture.vsx');
  assert.strictEqual(diagram.formatSupport, 'legacy-xml');
  assert.strictEqual(diagram.pages.length, 1, 'expected legacy XML stencil master preview page');
  assert.ok(diagram.pages[0].entry.startsWith('__master__'), 'expected master fallback entry');
  assert.strictEqual(diagram.pages[0].shapes[0]?.editable, false);
  assert.strictEqual(diagram.pages[0].shapes[0]?.text, 'Legacy stencil');
}

async function verifiesRotatedShapeStaysEditableAndPreservesAngle(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Rotated">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="Angle" V="0.7853981633974483"/>
      <Text>Rotated text</Text>
    </Shape>
  </Shapes>
</PageContents>`);

  const sourceBytes = await zip.generateAsync({ type: 'nodebuffer' });
  const diagram = await readVsdxDiagram(sourceBytes, 'rotated-shape-fixture.vsdx');
  const shape = diagram.pages[0]?.shapes[0];
  assert.ok(shape, 'expected rotated shape to be parsed');
  assert.strictEqual(shape.editable, true);
  assert.ok(Math.abs((shape.angle ?? 0) - 0.7853981633974483) < 0.0000001, 'expected angle to be exposed');

  const updatedDiagram = replaceShapeInDiagram(diagram, {
    pageEntry: diagram.pages[0].entry,
    shape: {
      ...shape,
      x: 3,
      y: 3,
      text: 'Rotated update'
    }
  });
  const updatedBytes = await writeVsdxDiagram(sourceBytes, updatedDiagram);
  const reread = await readVsdxDiagram(updatedBytes, 'rotated-shape-fixture.vsdx');
  const rereadShape = reread.pages[0]?.shapes[0];
  assert.strictEqual(rereadShape?.editable, true);
  assert.strictEqual(rereadShape?.text, 'Rotated update');
  assert.ok(Math.abs((rereadShape?.angle ?? 0) - 0.7853981633974483) < 0.0000001, 'expected angle to be preserved');
  assert.ok(Math.abs((rereadShape?.x ?? 0) - 3) < 0.0001, 'expected rotated shape x to write back');
  assert.ok(Math.abs((rereadShape?.y ?? 0) - 3) < 0.0001, 'expected rotated shape y to write back');
}

async function verifiesShapeResizeWriteBackCentersLocPin(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Resizable">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Cell N="LocPinX" V="0.2" F="GUARD(0.2)"/>
      <Cell N="LocPinY" V="0.3" F="GUARD(0.3)"/>
      <Text>Resizable</Text>
    </Shape>
  </Shapes>
</PageContents>`);

  const sourceBytes = await zip.generateAsync({ type: 'nodebuffer' });
  const diagram = await readVsdxDiagram(sourceBytes, 'resize-writeback-fixture.vsdx');
  const shape = diagram.pages[0]?.shapes[0];
  assert.ok(shape, 'expected shape to be parsed for resize write-back');
  assert.strictEqual(shape.editable, true);

  const updatedDiagram = replaceShapeInDiagram(diagram, {
    pageEntry: diagram.pages[0].entry,
    shape: {
      ...shape,
      width: 4,
      height: 2,
      text: 'Resized'
    }
  });
  const updatedBytes = await writeVsdxDiagram(sourceBytes, updatedDiagram);
  const updatedZip = await JSZip.loadAsync(updatedBytes);
  const pageXml = await updatedZip.file('visio/pages/page1.xml')?.async('text');
  assert.ok(pageXml, 'expected updated page XML for resize write-back');
  assert.ok(pageXml.includes('N="LocPinX" V="2"'), 'expected LocPinX to be centered after resize');
  assert.ok(pageXml.includes('N="LocPinY" V="1"'), 'expected LocPinY to be centered after resize');
  assert.ok(!pageXml.includes('GUARD('), 'expected stale LocPin formulas to be removed');

  const reread = await readVsdxDiagram(updatedBytes, 'resize-writeback-fixture.vsdx');
  const rereadShape = reread.pages[0]?.shapes[0];
  assert.ok(Math.abs((rereadShape?.width ?? 0) - 4) < 0.0001, 'expected resized width to persist');
  assert.ok(Math.abs((rereadShape?.height ?? 0) - 2) < 0.0001, 'expected resized height to persist');
  assert.strictEqual(rereadShape?.text, 'Resized');
}

async function verifiesGroupedShapeWriteBackUsesLocalCoordinates(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Group">
      <Cell N="PinX" V="4"/>
      <Cell N="PinY" V="4"/>
      <Cell N="Width" V="4"/>
      <Cell N="Height" V="4"/>
      <Cell N="LocPinX" V="2"/>
      <Cell N="LocPinY" V="2"/>
      <Shapes>
        <Shape ID="2" NameU="InnerBox">
          <Cell N="PinX" V="1"/>
          <Cell N="PinY" V="1"/>
          <Cell N="Width" V="1"/>
          <Cell N="Height" V="1"/>
          <Cell N="LocPinX" V="0.5"/>
          <Cell N="LocPinY" V="0.5"/>
          <Text>Inner box</Text>
        </Shape>
        <Shape ID="3" NameU="Dynamic connector" OneD="1">
          <Cell N="BeginX" V="0.5"/>
          <Cell N="BeginY" V="0.5"/>
          <Cell N="EndX" V="2.5"/>
          <Cell N="EndY" V="2.5"/>
        </Shape>
      </Shapes>
    </Shape>
  </Shapes>
</PageContents>`);

  const sourceBytes = await zip.generateAsync({ type: 'nodebuffer' });
  const diagram = await readVsdxDiagram(sourceBytes, 'group-writeback-fixture.vsdx');
  const innerBox = diagram.pages[0]?.shapes.find(candidate => candidate.id === '1/2');
  const innerConnector = diagram.pages[0]?.shapes.find(candidate => candidate.id === '1/3');
  assert.ok(innerBox, 'expected grouped child shape to be exposed');
  assert.ok(innerConnector, 'expected grouped child connector to be exposed');
  assert.strictEqual(innerBox.editable, true);
  assert.strictEqual(innerConnector.editable, true);
  assert.ok(Math.abs((innerBox.x ?? 0) - 2.5) < 0.0001, 'expected child shape x to be shown in page coordinates');
  assert.ok(Math.abs((innerConnector.beginX ?? 0) - 2.5) < 0.0001, 'expected connector begin x to be shown in page coordinates');

  const updatedDiagram = replaceShapeInDiagram(replaceShapeInDiagram(diagram, {
    pageEntry: diagram.pages[0].entry,
    shape: {
      ...innerBox,
      x: 3.5,
      y: 3.5,
      text: 'Moved inner box'
    }
  }), {
    pageEntry: diagram.pages[0].entry,
    shape: {
      ...innerConnector,
      beginX: 3,
      beginY: 3,
      endX: 5,
      endY: 5,
      text: 'Moved inner connector'
    }
  });

  const updatedBytes = await writeVsdxDiagram(sourceBytes, updatedDiagram);
  const updatedZip = await JSZip.loadAsync(updatedBytes);
  const pageXml = await updatedZip.file('visio/pages/page1.xml')?.async('text');
  assert.ok(pageXml, 'expected updated page XML for grouped write-back');
  assert.ok(pageXml.includes('<Cell N="PinX" V="2"/>'), 'expected grouped child PinX to remain in local coordinates');
  assert.ok(pageXml.includes('<Cell N="PinY" V="2"/>'), 'expected grouped child PinY to remain in local coordinates');
  assert.ok(pageXml.includes('<Cell N="BeginX" V="1"/>'), 'expected grouped connector BeginX to remain in local coordinates');
  assert.ok(pageXml.includes('<Cell N="EndX" V="3"/>'), 'expected grouped connector EndX to remain in local coordinates');

  const reread = await readVsdxDiagram(updatedBytes, 'group-writeback-fixture.vsdx');
  const rereadBox = reread.pages[0]?.shapes.find(candidate => candidate.id === '1/2');
  const rereadConnector = reread.pages[0]?.shapes.find(candidate => candidate.id === '1/3');
  assert.strictEqual(rereadBox?.text, 'Moved inner box');
  assert.ok(Math.abs((rereadBox?.x ?? 0) - 3.5) < 0.0001, 'expected reread grouped child x to match page edit');
  assert.ok(Math.abs((rereadBox?.y ?? 0) - 3.5) < 0.0001, 'expected reread grouped child y to match page edit');
  assert.strictEqual(rereadConnector?.text, 'Moved inner connector');
  assert.ok(Math.abs((rereadConnector?.beginX ?? 0) - 3) < 0.0001, 'expected reread grouped connector begin x to match page edit');
  assert.ok(Math.abs((rereadConnector?.endX ?? 0) - 5) < 0.0001, 'expected reread grouped connector end x to match page edit');
}

async function verifiesLegacyXmlGroupedShapeWriteBackUsesLocalCoordinates(): Promise<void> {
  const source = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<VisioDocument>
  <Pages>
    <Page ID="1" Name="Legacy XML Group">
      <PageSheet><PageProps><PageWidth>8</PageWidth><PageHeight>6</PageHeight></PageProps></PageSheet>
      <Shapes>
        <Shape ID="1" NameU="Group">
          <XForm>
            <PinX>4</PinX>
            <PinY>4</PinY>
            <Width>4</Width>
            <Height>4</Height>
            <LocPinX>2</LocPinX>
            <LocPinY>2</LocPinY>
          </XForm>
          <Shapes>
            <Shape ID="2" NameU="InnerBox">
              <XForm>
                <PinX>1</PinX>
                <PinY>1</PinY>
                <Width>1</Width>
                <Height>1</Height>
                <LocPinX>0.5</LocPinX>
                <LocPinY>0.5</LocPinY>
              </XForm>
              <Text>Legacy inner box</Text>
            </Shape>
            <Shape ID="3" NameU="Dynamic connector" OneD="1">
              <XForm1D>
                <BeginX>0.5</BeginX>
                <BeginY>0.5</BeginY>
                <EndX>2.5</EndX>
                <EndY>2.5</EndY>
              </XForm1D>
            </Shape>
          </Shapes>
        </Shape>
      </Shapes>
    </Page>
  </Pages>
</VisioDocument>`, 'utf8');

  const diagram = await readVsdxDiagram(source, 'legacy-group-writeback-fixture.vdx');
  const innerBox = diagram.pages[0]?.shapes.find(candidate => candidate.id === '1/2');
  const innerConnector = diagram.pages[0]?.shapes.find(candidate => candidate.id === '1/3');
  assert.ok(innerBox, 'expected legacy XML grouped child shape to be exposed');
  assert.ok(innerConnector, 'expected legacy XML grouped child connector to be exposed');
  assert.strictEqual(innerBox.editable, true);
  assert.strictEqual(innerConnector.editable, true);

  const updatedDiagram = replaceShapeInDiagram(replaceShapeInDiagram(diagram, {
    pageEntry: diagram.pages[0].entry,
    shape: {
      ...innerBox,
      x: 3.5,
      y: 3.5,
      text: 'Moved legacy inner box'
    }
  }), {
    pageEntry: diagram.pages[0].entry,
    shape: {
      ...innerConnector,
      beginX: 3,
      beginY: 3,
      endX: 5,
      endY: 5,
      text: 'Moved legacy connector'
    }
  });

  const updatedBytes = await writeVsdxDiagram(source, updatedDiagram);
  const updatedXml = updatedBytes.toString('utf8');
  assert.ok(updatedXml.includes('XForm PinX="2" PinY="2"'), 'expected legacy grouped child coordinates to remain local');
  assert.ok(updatedXml.includes('XForm1D BeginX="1" BeginY="1" EndX="3" EndY="3"'), 'expected legacy grouped connector endpoints to remain local');

  const reread = await readVsdxDiagram(updatedBytes, 'legacy-group-writeback-fixture.vdx');
  const rereadBox = reread.pages[0]?.shapes.find(candidate => candidate.id === '1/2');
  const rereadConnector = reread.pages[0]?.shapes.find(candidate => candidate.id === '1/3');
  assert.strictEqual(rereadBox?.text, 'Moved legacy inner box');
  assert.ok(Math.abs((rereadBox?.x ?? 0) - 3.5) < 0.0001, 'expected reread legacy grouped child x to match page edit');
  assert.ok(Math.abs((rereadBox?.y ?? 0) - 3.5) < 0.0001, 'expected reread legacy grouped child y to match page edit');
  assert.strictEqual(rereadConnector?.text, 'Moved legacy connector');
  assert.ok(Math.abs((rereadConnector?.beginX ?? 0) - 3) < 0.0001, 'expected reread legacy grouped connector begin x to match page edit');
  assert.ok(Math.abs((rereadConnector?.endX ?? 0) - 5) < 0.0001, 'expected reread legacy grouped connector end x to match page edit');
}

async function verifiesRotatedGroupedTextWriteBackPreservesLocalSize(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="RotatedGroup">
      <Cell N="PinX" V="4"/>
      <Cell N="PinY" V="4"/>
      <Cell N="Width" V="4"/>
      <Cell N="Height" V="4"/>
      <Cell N="LocPinX" V="2"/>
      <Cell N="LocPinY" V="2"/>
      <Cell N="Angle" V="0.7853981633974483"/>
      <Shapes>
        <Shape ID="2" NameU="InnerBox">
          <Cell N="PinX" V="2"/>
          <Cell N="PinY" V="2"/>
          <Cell N="Width" V="2"/>
          <Cell N="Height" V="1"/>
          <Cell N="LocPinX" V="1"/>
          <Cell N="LocPinY" V="0.5"/>
          <Text>Rotated inner</Text>
        </Shape>
      </Shapes>
    </Shape>
  </Shapes>
</PageContents>`);

  const sourceBytes = await zip.generateAsync({ type: 'nodebuffer' });
  const diagram = await readVsdxDiagram(sourceBytes, 'rotated-group-writeback-fixture.vsdx');
  const innerBox = diagram.pages[0]?.shapes.find(candidate => candidate.id === '1/2');
  assert.ok(innerBox, 'expected rotated grouped child shape to be exposed');
  assert.strictEqual(innerBox.editable, true);
  assert.ok((innerBox.width ?? 0) > 2, 'expected rotated child width to be exposed as page-space bbox');

  const updatedDiagram = replaceShapeInDiagram(diagram, {
    pageEntry: diagram.pages[0].entry,
    shape: {
      ...innerBox,
      text: 'Renamed only'
    }
  });
  const updatedBytes = await writeVsdxDiagram(sourceBytes, updatedDiagram);
  const updatedZip = await JSZip.loadAsync(updatedBytes);
  const pageXml = await updatedZip.file('visio/pages/page1.xml')?.async('text');
  assert.ok(pageXml, 'expected updated rotated group page XML');
  assert.ok(pageXml.includes('<Cell N="Width" V="2"/>'), 'expected local child width to survive text-only save');
  assert.ok(pageXml.includes('<Cell N="Height" V="1"/>'), 'expected local child height to survive text-only save');

  const reread = await readVsdxDiagram(updatedBytes, 'rotated-group-writeback-fixture.vsdx');
  const rereadBox = reread.pages[0]?.shapes.find(candidate => candidate.id === '1/2');
  assert.strictEqual(rereadBox?.text, 'Renamed only');
  assert.ok(Math.abs((rereadBox?.width ?? 0) - (innerBox.width ?? 0)) < 0.0001, 'expected page-space width to remain stable after text edit');
  assert.ok(Math.abs((rereadBox?.height ?? 0) - (innerBox.height ?? 0)) < 0.0001, 'expected page-space height to remain stable after text edit');
}

async function verifiesMasterFallbackWhenPageGeometryIsIncomplete(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/masters/masters.xml', `<?xml version="1.0" encoding="UTF-8"?>
<Masters xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Master ID="2" NameU="Fallback"><Rel r:id="rId1"/></Master>
</Masters>`);
  zip.file('visio/masters/_rels/masters.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master1.xml"/>
</Relationships>`);
  zip.file('visio/masters/master1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<MasterContents>
  <Shapes>
    <Shape ID="5">
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="2"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="3"><Cell N="X" V="2"/><Cell N="Y" V="1"/></Row>
      </Section>
    </Shape>
  </Shapes>
</MasterContents>`);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Fallback" Master="2">
      <Cell N="PinX" V="4"/>
      <Cell N="PinY" V="4"/>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1" Del="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
      </Section>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'fallback-fixture.vsdx');
  const geometryPath = diagram.pages[0]?.shapes[0]?.geometryPath ?? '';
  assert.ok(geometryPath.startsWith('M 0 1 L 2 1 L 2 0'), 'expected incomplete page geometry to fall back to master geometry');
}

async function verifiesConnectorGeometryRows(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Dynamic connector">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="1"/>
      <Cell N="Height" V="2"/>
      <Cell N="BeginX" V="2"/>
      <Cell N="BeginY" V="1"/>
      <Cell N="EndX" V="2"/>
      <Cell N="EndY" V="3"/>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0.5"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="0.5"/><Cell N="Y" V="2"/></Row>
      </Section>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'connector-geometry-fixture.vsdx');
  const connector = diagram.pages[0]?.shapes[0];
  assert.ok(connector, 'expected connector to be parsed');
  assert.strictEqual(connector.kind, 'connector');
  assert.strictEqual(connector.editable, true);
  assert.strictEqual(connector.geometryPath, 'M 0.5 2 L 0.5 0');
}

async function verifiesConnectorArrowAndLinePattern(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Connector" OneD="1">
      <Cell N="BeginX" V="1"/>
      <Cell N="BeginY" V="2"/>
      <Cell N="EndX" V="5"/>
      <Cell N="EndY" V="2"/>
      <Cell N="PinX" V="3"/>
      <Cell N="PinY" V="2"/>
      <Cell N="Width" V="4"/>
      <Cell N="Height" V="0"/>
      <Cell N="LinePattern" V="2"/>
      <Cell N="BeginArrow" V="13"/>
      <Cell N="EndArrow" V="13"/>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'connector-style-fixture.vsdx');
  const connector = diagram.pages[0]?.shapes[0];
  assert.ok(connector, 'expected connector to be parsed');
  assert.strictEqual(connector.kind, 'connector');
  assert.strictEqual(connector.linePattern, 2, 'expected dashed line pattern to be exposed');
  assert.strictEqual(connector.beginArrow, 13, 'expected begin arrow to be exposed');
  assert.strictEqual(connector.endArrow, 13, 'expected end arrow to be exposed');
}

async function verifiesEmbeddedImageRelationship(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/pages/_rels/page1.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdImage1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`);
  zip.file('visio/media/image1.png', Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64'
  ));
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="Picture">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="3"/>
      <Cell N="Width" V="1.5"/>
      <Cell N="Height" V="1"/>
      <ForeignData ForeignType="Bitmap" CompressionType="PNG">
        <Rel r:id="rIdImage1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
      </ForeignData>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'image-fixture.vsdx');
  const shape = diagram.pages[0]?.shapes[0] as any;
  assert.ok(shape, 'expected image shape to be parsed');
  assert.strictEqual(shape.editable, true);
  assert.ok(
    typeof shape.imageDataUri === 'string' && shape.imageDataUri.startsWith('data:image/png;base64,'),
    'expected image relationship to be exposed as a data URI'
  );
}

async function verifiesMasterImageRelationship(): Promise<void> {
  const zip = new JSZip();
  addSinglePageMetadata(zip);
  zip.file('visio/masters/masters.xml', `<?xml version="1.0" encoding="UTF-8"?>
<Masters xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Master ID="8" NameU="PictureMaster"><Rel r:id="rIdMaster1"/></Master>
</Masters>`);
  zip.file('visio/masters/_rels/masters.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMaster1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master1.xml"/>
</Relationships>`);
  zip.file('visio/masters/_rels/master1.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMasterImage1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/master-image1.png"/>
</Relationships>`);
  zip.file('visio/media/master-image1.png', tinyPngBuffer());
  zip.file('visio/masters/master1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<MasterContents>
  <Shapes>
    <Shape ID="9" NameU="PictureMaster">
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
      <ForeignData ForeignType="Bitmap" CompressionType="PNG">
        <Rel r:id="rIdMasterImage1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
      </ForeignData>
    </Shape>
  </Shapes>
</MasterContents>`);
  zip.file('visio/pages/page1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<PageContents>
  <Shapes>
    <Shape ID="1" NameU="PictureMaster" Master="8">
      <Cell N="PinX" V="3"/>
      <Cell N="PinY" V="4"/>
      <Cell N="Width" V="2"/>
      <Cell N="Height" V="1"/>
    </Shape>
  </Shapes>
</PageContents>`);

  const diagram = await readVsdxDiagram(await zip.generateAsync({ type: 'nodebuffer' }), 'master-image-fixture.vsdx');
  const shape = diagram.pages[0]?.shapes[0];
  assert.ok(shape, 'expected master image instance to be parsed');
  assert.ok(
    typeof shape.imageDataUri === 'string' && shape.imageDataUri.startsWith('data:image/png;base64,'),
    'expected image relationship from master rels to be exposed as a data URI'
  );
}

async function verifiesLegacyXmlInlineImageData(): Promise<void> {
  const source = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<VisioDocument>
  <Pages>
    <Page ID="1" Name="Inline image">
      <PageSheet><PageProps><PageWidth>8</PageWidth><PageHeight>6</PageHeight></PageProps></PageSheet>
      <Shapes>
        <Shape ID="1" NameU="InlineBitmap">
          <XForm><PinX>3</PinX><PinY>3</PinY><Width>2</Width><Height>1</Height></XForm>
          <ForeignData ForeignType="Bitmap" CompressionType="PNG">
            <Data>${tinyPngBase64()}</Data>
          </ForeignData>
        </Shape>
      </Shapes>
    </Page>
  </Pages>
</VisioDocument>`);

  const diagram = await readVsdxDiagram(source, 'legacy-inline-image-fixture.vdx');
  const shape = diagram.pages[0]?.shapes[0];
  assert.ok(shape, 'expected legacy XML inline image to be parsed');
  assert.ok(
    typeof shape.imageDataUri === 'string' && shape.imageDataUri.startsWith('data:image/png;base64,'),
    'expected inline legacy XML image data to be exposed as a data URI'
  );
}

function tinyPngBuffer(): Buffer {
  return Buffer.from(tinyPngBase64(), 'base64');
}

function tinyPngBase64(): string {
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
}

function addSinglePageMetadata(zip: JSZip): void {
  zip.file('visio/pages/pages.xml', `<?xml version="1.0" encoding="UTF-8"?>
<Pages xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Page ID="0" Name="Page-1">
    <PageSheet>
      <Cell N="PageWidth" V="8.5"/>
      <Cell N="PageHeight" V="11"/>
    </PageSheet>
    <Rel r:id="rIdPage1"/>
  </Page>
</Pages>`);
  zip.file('visio/pages/_rels/pages.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdPage1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>
</Relationships>`);
}

function countXmlDeclarations(xml: string): number {
  return xml.match(/<\?xml\b/gi)?.length ?? 0;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
