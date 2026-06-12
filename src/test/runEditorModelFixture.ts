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
  await verifiesColorFormulaAndNoPaint();
  await verifiesStyleSheetInheritanceForShapePaintAndConnectorStyle();
  await verifiesMasterChildShapeExpansion();
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
    </StyleSheet>
    <StyleSheet ID="7" NameU="Flow Normal" LineStyle="3" FillStyle="3" TextStyle="3">
      <Cell N="FillForegnd" V="#123456"/>
      <Cell N="FillPattern" V="1"/>
      <Cell N="LineColor" V="#654321"/>
      <Cell N="LinePattern" V="2"/>
      <Cell N="LineWeight" V="0.03"/>
      <Cell N="BeginArrow" V="4"/>
      <Cell N="EndArrow" V="13"/>
    </StyleSheet>
    <StyleSheet ID="8" NameU="Connector" LineStyle="7" FillStyle="7" TextStyle="7">
      <Cell N="LineColor" V="#abcdef"/>
      <Cell N="LinePattern" V="3"/>
      <Cell N="EndArrow" V="5"/>
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
  assert.strictEqual(direct?.line, '#654321', 'expected page shape line to inherit from LineStyle');
  assert.strictEqual(direct?.linePattern, 2, 'expected page shape line pattern to inherit from LineStyle');
  assert.ok(Math.abs((direct?.strokeWidth ?? 0) - 0.03) < 0.0001, 'expected page shape stroke width to inherit from LineStyle');
  assert.strictEqual(inheritedFromMaster?.fill, '#123456', 'expected master style fill to reach page instance');
  assert.strictEqual(inheritedFromMaster?.line, '#654321', 'expected master style line to reach page instance');
  assert.strictEqual(inheritedFromMaster?.width, 2, 'expected master width to remain available through effective cells');
  assert.strictEqual(inheritedFromMaster?.height, 1, 'expected master height to remain available through effective cells');
  assert.strictEqual(connector?.kind, 'connector');
  assert.strictEqual(connector?.line, '#abcdef', 'expected connector line color to inherit from connector LineStyle');
  assert.strictEqual(connector?.linePattern, 3, 'expected connector line pattern to inherit from connector LineStyle');
  assert.strictEqual(connector?.endArrow, 5, 'expected connector end arrow to inherit from connector LineStyle');
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
      <Cell N="LineColor" V="#6688aa"/>
      <Cell N="LinePattern" V="2"/>
      <Cell N="LineWeight" V="0.04"/>
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
  assert.strictEqual(shape?.line, '#6688aa', 'expected legacy XML LineStyle to be applied');
  assert.strictEqual(shape?.linePattern, 2, 'expected legacy XML line pattern to be applied');
  assert.ok(Math.abs((shape?.strokeWidth ?? 0) - 0.04) < 0.0001, 'expected legacy XML line weight to be applied');
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

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
