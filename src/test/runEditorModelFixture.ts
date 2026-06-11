import * as assert from 'assert';
import JSZip from 'jszip';

import { readVsdxDiagram, replaceShapeInDiagram, writeVsdxDiagram } from '../editor/vsdxModel';

async function main(): Promise<void> {
  await verifiesMasterShapeGeometry();
  await verifiesCurvedGeometryRows();
  await verifiesAdvancedGeometryRows();
  await verifiesFormulaGeometryAndMasterRowInheritance();
  await verifiesColorFormulaAndNoPaint();
  await verifiesMasterChildShapeExpansion();
  await verifiesStencilMasterFallbackPreview();
  await verifiesLegacyVisioBinaryGetsReadOnlyDiagram();
  await verifiesRichTextWriteBackPreservesFormattingMarkers();
  await verifiesConnectorWriteBackSynchronizesGeometry();
  await verifiesConnectorGeometryRows();
  await verifiesMasterFallbackWhenPageGeometryIsIncomplete();
  await verifiesEmbeddedImageRelationship();
  console.log('Editor model fixture checks passed.');
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
  const writtenBytes = await writeVsdxDiagram(sourceBytes, diagram);
  assert.strictEqual(Buffer.compare(sourceBytes, writtenBytes), 0, 'expected legacy binary save to preserve original bytes');
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
