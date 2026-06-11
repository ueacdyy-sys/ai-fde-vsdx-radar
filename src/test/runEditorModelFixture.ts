import * as assert from 'assert';
import JSZip from 'jszip';

import { readVsdxDiagram } from '../editor/vsdxModel';

async function main(): Promise<void> {
  await verifiesMasterShapeGeometry();
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
