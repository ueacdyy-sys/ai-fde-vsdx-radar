import * as fs from 'fs/promises';
import * as path from 'path';
import JSZip from 'jszip';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  trimValues: false
});

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  format: false,
  suppressEmptyNode: true
});

export type VsdxEditorShapeKind = 'shape' | 'connector';

export interface VsdxEditorDiagram {
  sourceName: string;
  pages: VsdxEditorPage[];
  unsupportedNotes: string[];
}

export interface VsdxEditorPage {
  id: string;
  entry: string;
  name: string;
  width: number;
  height: number;
  shapes: VsdxEditorShape[];
}

export interface VsdxEditorShape {
  id: string;
  kind: VsdxEditorShapeKind;
  name: string;
  text: string;
  editable: boolean;
  reason?: string;
  fill: string;
  line: string;
  strokeWidth: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  beginX?: number;
  beginY?: number;
  endX?: number;
  endY?: number;
  imageDataUri?: string;
  geometryPath?: string;
}

export interface VsdxEditorShapeUpdate {
  pageEntry: string;
  shape: VsdxEditorShape;
}

interface PageMetadata {
  id: string;
  entry: string;
  name: string;
  width?: number;
  height?: number;
}

interface Point {
  x: number;
  y: number;
}

interface GeometrySource {
  cells: any[];
  sections: any[];
}

interface GeometryContext {
  targetWidth: number;
  targetHeight: number;
  scaleX: number;
  scaleY: number;
  scaleAverage: number;
}

interface PointTransform {
  toPage(point: Point): Point;
}

interface EditorShapeContext {
  modelId: string;
  masterShapes: Map<string, any>;
  imageDataUriByRelId: Map<string, string>;
}

export async function readVsdxDiagramFromFile(filePath: string): Promise<{ bytes: Buffer; diagram: VsdxEditorDiagram }> {
  const bytes = await fs.readFile(filePath);
  return {
    bytes,
    diagram: await readVsdxDiagram(bytes, filePath)
  };
}

export async function readVsdxDiagram(bytes: Buffer, sourceName: string): Promise<VsdxEditorDiagram> {
  const zip = await JSZip.loadAsync(bytes);
  const pageMetadata = await readPageMetadata(zip);
  const masterShapes = await readMasterShapes(zip);
  const pageEntries = Object.keys(zip.files)
    .filter(name => /^visio\/pages\/page\d+\.xml$/i.test(name))
    .sort(sortPageEntries);
  const pageResults = await Promise.all(pageEntries.map(async entry => {
    const file = zip.file(entry);
    if (!file) {
      return undefined;
    }

    const meta = pageMetadata.get(entry);
    const xml = await file.async('text');
    const parsed = xmlParser.parse(xml);
    const pageContents = parsed.PageContents ?? parsed['PageContents'];
    const imageDataUriByRelId = await readPageImageDataUris(zip, entry);
    const shapes = collectEditorShapes(toArray(pageContents?.Shapes?.Shape), {
      masterShapes,
      imageDataUriByRelId
    });
    const unsupportedCount = shapes.filter(shape => !shape.editable).length;
    const page = {
      id: meta?.id ?? entry,
      entry,
      name: meta?.name ?? entry.match(/page(\d+)\.xml$/i)?.[1] ?? entry,
      width: validPageSize(meta?.width, 8),
      height: validPageSize(meta?.height, 6),
      shapes
    };
    const unsupportedNote = unsupportedCount > 0
      ? `${page.name}: ${unsupportedCount} shape(s) are shown as read-only because they use grouping, rotation, or incomplete geometry.`
      : undefined;
    return { page, unsupportedNote };
  }));

  return {
    sourceName,
    pages: pageResults.map(result => result?.page).filter(isDefined),
    unsupportedNotes: pageResults.map(result => result?.unsupportedNote).filter(isDefined)
  };
}

export async function writeVsdxDiagramToFile(filePath: string, sourceBytes: Buffer, diagram: VsdxEditorDiagram): Promise<Buffer> {
  const bytes = await writeVsdxDiagram(sourceBytes, diagram);
  await fs.writeFile(filePath, bytes);
  return bytes;
}

export async function writeVsdxDiagram(sourceBytes: Buffer, diagram: VsdxEditorDiagram): Promise<Buffer> {
  const zip = await JSZip.loadAsync(sourceBytes);
  const pageByEntry = new Map(diagram.pages.map(page => [page.entry, page]));

  for (const [entry, page] of pageByEntry) {
    const file = zip.file(entry);
    if (!file) {
      continue;
    }

    const xml = await file.async('text');
    const parsed = xmlParser.parse(xml);
    const pageContents = parsed.PageContents ?? parsed['PageContents'];
    const shapes = toArray(pageContents?.Shapes?.Shape);
    const updateById = new Map(page.shapes.map(shape => [shape.id, shape]));
    applyShapeUpdates(shapes, updateById);
    const body = xmlBuilder.build(parsed);
    zip.file(entry, `<?xml version="1.0" encoding="UTF-8"?>\n${body}`);
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });
}

export function replaceShapeInDiagram(diagram: VsdxEditorDiagram, update: VsdxEditorShapeUpdate): VsdxEditorDiagram {
  return {
    ...diagram,
    pages: diagram.pages.map(page => {
      if (page.entry !== update.pageEntry) {
        return page;
      }

      return {
        ...page,
        shapes: page.shapes.map(shape => shape.id === update.shape.id ? normalizeShapeUpdate(shape, update.shape) : shape)
      };
    })
  };
}

function normalizeShapeUpdate(previous: VsdxEditorShape, next: VsdxEditorShape): VsdxEditorShape {
  const merged = { ...previous, ...next };
  if (previous.kind === 'connector') {
    return {
      ...merged,
      kind: 'connector',
      beginX: cleanNumber(merged.beginX, previous.beginX),
      beginY: cleanNumber(merged.beginY, previous.beginY),
      endX: cleanNumber(merged.endX, previous.endX),
      endY: cleanNumber(merged.endY, previous.endY),
      text: typeof merged.text === 'string' ? merged.text : previous.text
    };
  }

  return {
    ...merged,
    kind: 'shape',
    x: cleanNumber(merged.x, previous.x),
    y: cleanNumber(merged.y, previous.y),
    width: Math.max(0.05, cleanNumber(merged.width, previous.width)),
    height: Math.max(0.05, cleanNumber(merged.height, previous.height)),
    text: typeof merged.text === 'string' ? merged.text : previous.text
  };
}

function collectEditorShapes(
  shapes: any[],
  context: Omit<EditorShapeContext, 'modelId'>,
  parentPath = '',
  parentTransform?: PointTransform
): VsdxEditorShape[] {
  const collected: VsdxEditorShape[] = [];
  const idCounts = countShapeIds(shapes);
  const seenIds = new Map<string, number>();

  shapes.forEach((shape, index) => {
    const modelId = createModelShapeId(shape, index, parentPath, idCounts, seenIds);
    if (!modelId) {
      return;
    }

    const pageShape = parentTransform ? transformShapeCoordinates(shape, parentTransform) : shape;
    const editorShape = toEditorShape(pageShape, {
      ...context,
      modelId
    });
    if (editorShape) {
      collected.push(editorShape);
    }

    const childShapes = toArray(shape?.Shapes?.Shape);
    if (childShapes.length > 0) {
      const childTransform = createLocalToPageTransform(shape, parentTransform);
      collected.push(...collectEditorShapes(childShapes, context, modelId, childTransform));
    }
  });

  return collected;
}

function toEditorShape(shape: any, context: EditorShapeContext): VsdxEditorShape | undefined {
  const id = context.modelId;
  if (!id) {
    return undefined;
  }

  const cells = toArray(shape?.Cell);
  const masterShape = readMasterShapeFor(shape, context.masterShapes);
  const masterCells = toArray(masterShape?.Cell);
  const lineWeight = readCellNumber(cells, 'LineWeight') ?? readCellNumber(masterCells, 'LineWeight');
  const angle = readCellNumber(cells, 'Angle') ?? readCellNumber(masterCells, 'Angle') ?? 0;
  const hasChildShapes = toArray(shape?.Shapes?.Shape).length > 0;
  const isConnector = isConnectorShape(shape);
  const text = readShapeText(shape) || readShapeText(masterShape);
  const imageDataUri = readShapeImageDataUri(shape, context.imageDataUriByRelId);
  const base = {
    id,
    name: String(shape?.Name ?? shape?.NameU ?? masterShape?.Name ?? masterShape?.NameU ?? id),
    text,
    fill: readCellString(cells, 'FillForegnd') ?? readCellString(masterCells, 'FillForegnd') ?? '#ffffff',
    line: readCellString(cells, 'LineColor') ?? readCellString(masterCells, 'LineColor') ?? '#586069',
    strokeWidth: Math.max(0.015, lineWeight ?? 0.02)
  };

  if (isConnector) {
    const beginX = readCellNumber(cells, 'BeginX');
    const beginY = readCellNumber(cells, 'BeginY');
    const endX = readCellNumber(cells, 'EndX');
    const endY = readCellNumber(cells, 'EndY');
    const pinX = readCellNumber(cells, 'PinX');
    const pinY = readCellNumber(cells, 'PinY');
    const width = readCellNumber(cells, 'Width') ?? readCellNumber(masterCells, 'Width');
    const height = readCellNumber(cells, 'Height') ?? readCellNumber(masterCells, 'Height');
    const geometryPath = width !== undefined && height !== undefined
      ? compileGeometryPath(shape, masterShape, width, height)
      : undefined;
    const editable = [beginX, beginY, endX, endY].every(value => value !== undefined) && !hasChildShapes;
    return {
      ...base,
      kind: 'connector',
      editable,
      reason: editable ? undefined : 'Connector endpoints are incomplete or nested.',
      beginX,
      beginY,
      endX,
      endY,
      x: pinX !== undefined && width !== undefined ? pinX - width / 2 : undefined,
      y: pinY !== undefined && height !== undefined ? pinY - height / 2 : undefined,
      width,
      height,
      geometryPath
    };
  }

  const pinX = readCellNumber(cells, 'PinX');
  const pinY = readCellNumber(cells, 'PinY');
  const width = readCellNumber(cells, 'Width') ?? readCellNumber(masterCells, 'Width');
  const height = readCellNumber(cells, 'Height') ?? readCellNumber(masterCells, 'Height');
  const geometryPath = width !== undefined && height !== undefined
    ? compileGeometryPath(shape, masterShape, width, height)
    : undefined;
  const editable = [pinX, pinY, width, height].every(value => value !== undefined)
    && Math.abs(angle) < 0.0001
    && !hasChildShapes;
  return {
    ...base,
    kind: 'shape',
    editable,
    reason: editable ? undefined : 'Shape uses rotation, grouping, or incomplete geometry.',
    x: pinX !== undefined && width !== undefined ? pinX - width / 2 : undefined,
    y: pinY !== undefined && height !== undefined ? pinY - height / 2 : undefined,
    width,
    height,
    imageDataUri,
    geometryPath
  };
}

function applyShapeUpdates(shapes: any[], updateById: Map<string, VsdxEditorShape>, parentPath = ''): void {
  const idCounts = countShapeIds(shapes);
  const seenIds = new Map<string, number>();

  shapes.forEach((shape, index) => {
    const id = createModelShapeId(shape, index, parentPath, idCounts, seenIds);
    const update = id ? updateById.get(id) : undefined;
    if (update?.editable) {
      applyShapeUpdate(shape, update);
    }

    const childShapes = toArray(shape?.Shapes?.Shape);
    if (childShapes.length > 0) {
      applyShapeUpdates(childShapes, updateById, id);
    }
  });
}

function applyShapeUpdate(shape: any, update: VsdxEditorShape): void {
  const cells = ensureArrayProperty(shape, 'Cell');
  if (update.kind === 'connector') {
    setCellNumber(cells, 'BeginX', cleanNumber(update.beginX, 0));
    setCellNumber(cells, 'BeginY', cleanNumber(update.beginY, 0));
    setCellNumber(cells, 'EndX', cleanNumber(update.endX, 0));
    setCellNumber(cells, 'EndY', cleanNumber(update.endY, 0));
    writeShapeText(shape, update.text);
    return;
  }

  const width = Math.max(0.05, cleanNumber(update.width, 1));
  const height = Math.max(0.05, cleanNumber(update.height, 0.6));
  const pinX = cleanNumber(update.x, 0) + width / 2;
  const pinY = cleanNumber(update.y, 0) + height / 2;
  setCellNumber(cells, 'PinX', pinX);
  setCellNumber(cells, 'PinY', pinY);
  setCellNumber(cells, 'Width', width);
  setCellNumber(cells, 'Height', height);
  writeShapeText(shape, update.text);
}

async function readPageMetadata(zip: JSZip): Promise<Map<string, PageMetadata>> {
  const metadata = new Map<string, PageMetadata>();
  const pagesFile = zip.file('visio/pages/pages.xml');
  const relsFile = zip.file('visio/pages/_rels/pages.xml.rels');
  if (!pagesFile || !relsFile) {
    return metadata;
  }

  const [pagesXml, relsXml] = await Promise.all([
    pagesFile.async('text'),
    relsFile.async('text')
  ]);
  const pagesParsed = xmlParser.parse(pagesXml);
  const relsParsed = xmlParser.parse(relsXml);
  const relationships = toArray(relsParsed.Relationships?.Relationship);
  const targetById = new Map<string, string>();
  for (const rel of relationships) {
    if (typeof rel?.Id === 'string' && typeof rel?.Target === 'string') {
      targetById.set(rel.Id, normalizePageEntry(rel.Target));
    }
  }

  for (const page of toArray(pagesParsed.Pages?.Page)) {
    const relId = page?.Rel?.['r:id'] ?? page?.Rel?.id;
    const entry = typeof relId === 'string' ? targetById.get(relId) : undefined;
    if (!entry) {
      continue;
    }

    const cells = toArray(page?.PageSheet?.Cell);
    metadata.set(entry, {
      id: String(page?.ID ?? entry),
      entry,
      name: String(page?.Name ?? page?.NameU ?? entry),
      width: readCellNumber(cells, 'PageWidth'),
      height: readCellNumber(cells, 'PageHeight')
    });
  }
  return metadata;
}

async function readMasterShapes(zip: JSZip): Promise<Map<string, any>> {
  const masterShapes = new Map<string, any>();
  const mastersFile = zip.file('visio/masters/masters.xml');
  const relsFile = zip.file('visio/masters/_rels/masters.xml.rels');
  if (!mastersFile || !relsFile) {
    return masterShapes;
  }

  const [mastersXml, relsXml] = await Promise.all([
    mastersFile.async('text'),
    relsFile.async('text')
  ]);
  const mastersParsed = xmlParser.parse(mastersXml);
  const relsParsed = xmlParser.parse(relsXml);
  const targetById = new Map<string, string>();
  for (const rel of toArray(relsParsed.Relationships?.Relationship)) {
    if (typeof rel?.Id === 'string' && typeof rel?.Target === 'string') {
      targetById.set(rel.Id, normalizePackageTarget('visio/masters/masters.xml', rel.Target));
    }
  }

  const masterEntries = await Promise.all(toArray(mastersParsed.Masters?.Master).map(async master => {
    const id = normalizedId(master?.ID);
    const relId = master?.Rel?.['r:id'] ?? master?.Rel?.id;
    const entry = typeof relId === 'string' ? targetById.get(relId) : undefined;
    const masterFile = entry ? zip.file(entry) : undefined;
    if (!id || !masterFile) {
      return undefined;
    }

    const parsed = xmlParser.parse(await masterFile.async('text'));
    const contents = parsed.MasterContents ?? parsed['MasterContents'];
    const shape = toArray(contents?.Shapes?.Shape)[0];
    return shape
      ? {
        id,
        shape: {
        ...shape,
        Name: master?.Name ?? shape?.Name,
        NameU: master?.NameU ?? shape?.NameU
        }
      }
      : undefined;
  }));

  for (const entry of masterEntries) {
    if (entry) {
      masterShapes.set(entry.id, entry.shape);
    }
  }

  return masterShapes;
}

async function readPageImageDataUris(zip: JSZip, pageEntry: string): Promise<Map<string, string>> {
  const images = new Map<string, string>();
  const relsFile = zip.file(pageRelationshipEntry(pageEntry));
  if (!relsFile) {
    return images;
  }

  const parsed = xmlParser.parse(await relsFile.async('text'));
  for (const rel of toArray(parsed.Relationships?.Relationship)) {
    if (typeof rel?.Id !== 'string' || typeof rel?.Target !== 'string') {
      continue;
    }

    const target = normalizePackageTarget(pageEntry, rel.Target);
    const mimeType = mimeTypeForImageTarget(target);
    const isImageRel = String(rel?.Type ?? '').toLowerCase().includes('/image');
    if (!mimeType || !isImageRel) {
      continue;
    }

    const mediaFile = zip.file(target);
    if (!mediaFile) {
      continue;
    }

    images.set(rel.Id, `data:${mimeType};base64,${await mediaFile.async('base64')}`);
  }

  return images;
}

function normalizePageEntry(target: string): string {
  const normalized = target.replace(/\\/g, '/').replace(/^\.\//, '');
  return normalized.startsWith('visio/pages/') ? normalized : `visio/pages/${normalized}`;
}

function normalizePackageTarget(sourceEntry: string, target: string): string {
  const normalizedTarget = target.replace(/\\/g, '/');
  if (normalizedTarget.startsWith('/')) {
    return path.posix.normalize(normalizedTarget.slice(1));
  }
  return path.posix.normalize(path.posix.join(path.posix.dirname(sourceEntry), normalizedTarget)).replace(/^\.\//, '');
}

function pageRelationshipEntry(pageEntry: string): string {
  return `${path.posix.dirname(pageEntry)}/_rels/${path.posix.basename(pageEntry)}.rels`;
}

function mimeTypeForImageTarget(target: string): string | undefined {
  const extension = path.posix.extname(target).toLowerCase();
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return undefined;
  }
}

function readCellNumber(cells: unknown[], name: string): number | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === name) as any;
  const value = Number(cell?.V);
  return Number.isFinite(value) ? value : undefined;
}

function readCellString(cells: unknown[], name: string): string | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === name) as any;
  return typeof cell?.V === 'string' && cell.V.trim().length > 0 ? cell.V : undefined;
}

function readCellFormula(cells: unknown[], name: string): string | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === name) as any;
  return typeof cell?.F === 'string' && cell.F.trim().length > 0 ? cell.F : undefined;
}

function readMasterShapeFor(shape: any, masterShapes: Map<string, any>): any | undefined {
  const masterId = normalizedId(shape?.Master);
  return masterId ? masterShapes.get(masterId) : undefined;
}

function readShapeImageDataUri(shape: any, imageDataUriByRelId: Map<string, string>): string | undefined {
  for (const foreignData of toArray(shape?.ForeignData)) {
    const rel = foreignData?.Rel;
    const relId = rel?.['r:id'] ?? rel?.id ?? rel?.Id;
    if (typeof relId === 'string') {
      const image = imageDataUriByRelId.get(relId);
      if (image) {
        return image;
      }
    }
  }
  return undefined;
}

function compileGeometryPath(shape: any, masterShape: any, targetWidth: number, targetHeight: number): string | undefined {
  const candidates = [
    ...geometrySourcesFor(shape),
    ...geometrySourcesFor(masterShape)
  ];

  for (const source of candidates) {
    const pathData = compileGeometrySource(source, targetWidth, targetHeight);
    if (pathData) {
      return pathData;
    }
  }

  return undefined;
}

function compileGeometrySource(source: GeometrySource, targetWidth: number, targetHeight: number): string | undefined {
  const sourceWidth = readCellNumber(source.cells, 'Width') ?? targetWidth;
  const sourceHeight = readCellNumber(source.cells, 'Height') ?? targetHeight;
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return undefined;
  }

  const context: GeometryContext = {
    targetWidth,
    targetHeight,
    scaleX: targetWidth / sourceWidth,
    scaleY: targetHeight / sourceHeight,
    scaleAverage: (Math.abs(targetWidth / sourceWidth) + Math.abs(targetHeight / sourceHeight)) / 2
  };
  const commands: string[] = [];

  for (const section of source.sections) {
    let firstPoint: Point | undefined;
    let lastPoint: Point | undefined;

    for (const row of toArray(section?.Row)) {
      if (String(row?.Del ?? '') === '1') {
        continue;
      }
      const cells = toArray(row?.Cell);
      const rowType = String(row?.T ?? row?.N ?? '').toLowerCase();
      const beforeLength = commands.length;
      const result = compileGeometryRow(rowType, cells, context, commands, lastPoint);
      if (result?.firstPoint) {
        firstPoint = firstPoint ?? result.firstPoint;
      }
      if (result?.lastPoint) {
        lastPoint = result.lastPoint;
      }
      if (beforeLength === commands.length && rowType === 'ellipse') {
        firstPoint = undefined;
        lastPoint = undefined;
      }
    }

    if (firstPoint && lastPoint && samePoint(firstPoint, lastPoint) && commands[commands.length - 1] !== 'Z') {
      commands.push('Z');
    }
  }

  if (commands.length < 2) {
    return undefined;
  }
  return commands.join(' ');
}

function compileGeometryRow(
  rowType: string,
  cells: any[],
  context: GeometryContext,
  commands: string[],
  lastPoint: Point | undefined
): { firstPoint?: Point; lastPoint?: Point } | undefined {
  const relative = rowType.startsWith('rel');
  const point = readGeometryPoint(cells, context, relative, rowType === 'moveto' || rowType === 'relmoveto' ? { x: 0, y: 0 } : undefined);
  if (rowType === 'ellipse') {
    return compileEllipseRow(cells, context, commands);
  }
  if (rowType === 'infiniteline') {
    return compileInfiniteLineRow(cells, context, commands, relative);
  }
  if (rowType === 'polylineto' || rowType === 'relpolylineto') {
    return compilePolylineRow(cells, context, commands, lastPoint, relative);
  }
  if (rowType === 'nurbsto') {
    return compileNurbsRow(cells, context, commands, lastPoint, relative);
  }

  if (!point) {
    return undefined;
  }
  if (rowType === 'moveto' || rowType === 'relmoveto' || commands.length === 0) {
    commands.push(pathCommand('M', point));
    return { firstPoint: point, lastPoint: point };
  }
  if (rowType === 'arcto' || rowType === 'relarcto') {
    const bow = (readCellNumber(cells, 'A') ?? 0) * (relative ? (context.targetWidth + context.targetHeight) / 2 : context.scaleAverage);
    const control = lastPoint ? arcControlPoint(lastPoint, point, bow) : point;
    commands.push(`Q ${formatPoint(control)} ${formatPoint(point)}`);
    return { lastPoint: point };
  }
  if (rowType === 'ellipticalarcto' || rowType === 'relellipticalarcto') {
    const control = readGeometryPointPair(cells, 'A', 'B', context, relative);
    if (control) {
      commands.push(`Q ${formatPoint(control)} ${formatPoint(point)}`);
    } else {
      commands.push(pathCommand('L', point));
    }
    return { lastPoint: point };
  }
  if (rowType === 'quadbezto' || rowType === 'relquadbezto') {
    const control = readGeometryPointPair(cells, 'A', 'B', context, relative);
    commands.push(control ? `Q ${formatPoint(control)} ${formatPoint(point)}` : pathCommand('L', point));
    return { lastPoint: point };
  }
  if (rowType === 'cubbezto' || rowType === 'relcubbezto') {
    const control1 = readGeometryPointPair(cells, 'A', 'B', context, relative);
    const control2 = readGeometryPointPair(cells, 'C', 'D', context, relative);
    commands.push(control1 && control2 ? `C ${formatPoint(control1)} ${formatPoint(control2)} ${formatPoint(point)}` : pathCommand('L', point));
    return { lastPoint: point };
  }
  if (rowType === 'splinestart' || rowType === 'splineknot') {
    commands.push(pathCommand(lastPoint ? 'L' : 'M', point));
    return { firstPoint: lastPoint ? undefined : point, lastPoint: point };
  }

  commands.push(pathCommand('L', point));
  return { lastPoint: point };
}

function geometrySourcesFor(shape: any): GeometrySource[] {
  if (!shape) {
    return [];
  }
  const sections = toArray(shape?.Section)
    .filter(section => String(section?.N ?? '').toLowerCase() === 'geometry')
    .sort(sortGeometrySections);
  return sections.length > 0 ? [{ cells: toArray(shape?.Cell), sections }] : [];
}

function sortGeometrySections(a: any, b: any): number {
  return cleanNumber(a?.IX, 0) - cleanNumber(b?.IX, 0);
}

function readGeometryPoint(cells: any[], context: GeometryContext, relative: boolean, fallback?: Point): Point | undefined {
  const x = readCellNumber(cells, 'X') ?? fallback?.x;
  const y = readCellNumber(cells, 'Y') ?? fallback?.y;
  return x !== undefined && y !== undefined ? toGeometryPoint(x, y, context, relative) : undefined;
}

function readGeometryPointPair(cells: any[], xName: string, yName: string, context: GeometryContext, relative: boolean): Point | undefined {
  const x = readCellNumber(cells, xName);
  const y = readCellNumber(cells, yName);
  return x !== undefined && y !== undefined ? toGeometryPoint(x, y, context, relative) : undefined;
}

function compilePolylineRow(
  cells: any[],
  context: GeometryContext,
  commands: string[],
  lastPoint: Point | undefined,
  relative: boolean
): { firstPoint?: Point; lastPoint?: Point } | undefined {
  const points = readFormulaPointList(cells, 'A', context, relative);
  const endpoint = readGeometryPoint(cells, context, relative);
  if (endpoint && !points.some(point => samePoint(point, endpoint))) {
    points.push(endpoint);
  }
  if (points.length === 0) {
    return undefined;
  }

  let firstPoint: Point | undefined;
  let currentPoint = lastPoint;
  for (const point of points) {
    if (!currentPoint) {
      commands.push(pathCommand('M', point));
      firstPoint = point;
    } else if (!samePoint(currentPoint, point)) {
      commands.push(pathCommand('L', point));
    }
    currentPoint = point;
  }
  return { firstPoint, lastPoint: currentPoint };
}

function compileNurbsRow(
  cells: any[],
  context: GeometryContext,
  commands: string[],
  lastPoint: Point | undefined,
  relative: boolean
): { firstPoint?: Point; lastPoint?: Point } | undefined {
  const point = readGeometryPoint(cells, context, relative);
  if (!point) {
    return undefined;
  }

  const formulaPoints = readFormulaPointList(cells, 'E', context, relative);
  const visiblePoints = formulaPoints.length > 1 ? formulaPoints : [point];
  let firstPoint: Point | undefined;
  let currentPoint = lastPoint;
  for (const visiblePoint of visiblePoints) {
    if (!currentPoint && commands.length === 0) {
      commands.push(pathCommand('M', visiblePoint));
      firstPoint = visiblePoint;
    } else if (!currentPoint) {
      commands.push(pathCommand('M', visiblePoint));
      firstPoint = visiblePoint;
    } else {
      commands.push(pathCommand('L', visiblePoint));
    }
    currentPoint = visiblePoint;
  }
  if (!currentPoint || !samePoint(currentPoint, point)) {
    commands.push(pathCommand(currentPoint ? 'L' : 'M', point));
    currentPoint = point;
  }
  return { firstPoint, lastPoint: currentPoint };
}

function compileEllipseRow(
  cells: any[],
  context: GeometryContext,
  commands: string[]
): { firstPoint?: Point; lastPoint?: Point } | undefined {
  const center = readGeometryPoint(cells, context, false);
  if (!center) {
    return undefined;
  }
  const pointA = readGeometryPointPair(cells, 'A', 'B', context, false);
  const pointB = readGeometryPointPair(cells, 'C', 'D', context, false);
  const rx = pointA ? Math.max(0.0001, distance(center, pointA)) : context.targetWidth / 2;
  const ry = pointB ? Math.max(0.0001, distance(center, pointB)) : context.targetHeight / 2;
  const start = { x: center.x + rx, y: center.y };
  const middle = { x: center.x - rx, y: center.y };
  commands.push(
    pathCommand('M', start),
    `A ${formatNumber(rx)} ${formatNumber(ry)} 0 1 0 ${formatPoint(middle)}`,
    `A ${formatNumber(rx)} ${formatNumber(ry)} 0 1 0 ${formatPoint(start)}`,
    'Z'
  );
  return { firstPoint: start, lastPoint: start };
}

function compileInfiniteLineRow(
  cells: any[],
  context: GeometryContext,
  commands: string[],
  relative: boolean
): { firstPoint?: Point; lastPoint?: Point } | undefined {
  const start = readGeometryPoint(cells, context, relative);
  const end = readGeometryPointPair(cells, 'A', 'B', context, relative);
  if (!start || !end) {
    return undefined;
  }
  commands.push(pathCommand('M', start), pathCommand('L', end));
  return { firstPoint: start, lastPoint: end };
}

function toGeometryPoint(x: number, y: number, context: GeometryContext, relative: boolean): Point {
  const scaledX = relative ? x * context.targetWidth : x * context.scaleX;
  const scaledY = relative ? y * context.targetHeight : y * context.scaleY;
  return {
    x: scaledX,
    y: context.targetHeight - scaledY
  };
}

function arcControlPoint(start: Point, end: Point, bow: number): Point {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.0001 || Math.abs(bow) < 0.0001) {
    return { x: midX, y: midY };
  }

  return {
    x: midX - (dy / length) * bow,
    y: midY + (dx / length) * bow
  };
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.0001 && Math.abs(a.y - b.y) < 0.0001;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathCommand(command: 'M' | 'L', point: Point): string {
  return `${command} ${formatPoint(point)}`;
}

function formatPoint(point: Point): string {
  return `${formatNumber(point.x)} ${formatNumber(point.y)}`;
}

function readFormulaPointList(cells: unknown[], name: string, context: GeometryContext, relative: boolean): Point[] {
  const formula = readCellFormula(cells, name) ?? readCellString(cells, name);
  const match = formula?.trim().match(/^[A-Z]+\((.*)\)$/i);
  if (!match) {
    return [];
  }

  const args = match[1];
  if (/[A-Z_]/i.test(args)) {
    return [];
  }

  const numbers = args.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
  if (numbers.length < 4 || numbers.length % 2 !== 0 || numbers.length > 80) {
    return [];
  }

  const points: Point[] = [];
  for (let index = 0; index < numbers.length; index += 2) {
    const x = numbers[index];
    const y = numbers[index + 1];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push(toGeometryPoint(x, y, context, relative));
    }
  }
  return points;
}

function setCellNumber(cells: any[], name: string, value: number): void {
  const cell = cells.find((candidate: any) => candidate?.N === name);
  const formatted = formatNumber(value);
  if (cell) {
    cell.V = formatted;
  } else {
    cells.push({ N: name, V: formatted });
  }
}

function readShapeText(shape: any): string {
  if (!shape || shape.Text === undefined || shape.Text === null) {
    return '';
  }
  return extractText(shape.Text);
}

function writeShapeText(shape: any, text: string): void {
  if (text === undefined) {
    return;
  }
  if (shape.Text && typeof shape.Text === 'object' && !Array.isArray(shape.Text)) {
    shape.Text['#text'] = text;
    return;
  }
  shape.Text = text;
}

function extractText(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(extractText).join('');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const direct = record['#text'];
    if (typeof direct === 'string') {
      return direct;
    }
    return Object.entries(record)
      .filter(([key]) => !key.startsWith('?') && !['cp', 'pp', 'tp'].includes(key))
      .map(([, nested]) => extractText(nested))
      .join('');
  }
  return '';
}

function countShapeIds(shapes: any[]): Map<string, number> {
  const counts = new Map<string, number>();
  shapes.forEach((shape, index) => {
    const id = normalizedId(shape?.ID) ?? `shape-${index + 1}`;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  return counts;
}

function createModelShapeId(
  shape: any,
  index: number,
  parentPath: string | undefined,
  idCounts: Map<string, number>,
  seenIds: Map<string, number>
): string | undefined {
  const rawId = normalizedId(shape?.ID) ?? `shape-${index + 1}`;
  const nextSeen = (seenIds.get(rawId) ?? 0) + 1;
  seenIds.set(rawId, nextSeen);
  const localId = (idCounts.get(rawId) ?? 0) > 1 ? `${rawId}[${nextSeen}]` : rawId;
  return parentPath ? `${parentPath}/${localId}` : localId;
}

function transformShapeCoordinates(shape: any, parentTransform: PointTransform): any {
  const cells = toArray(shape?.Cell);
  const transformedCells = cells.map((cell: any) => ({ ...cell }));
  const localToPageTransform = createLocalToPageTransform(shape, parentTransform);
  transformCellPointPair(transformedCells, parentTransform, 'PinX', 'PinY');
  transformCellPointPair(transformedCells, parentTransform, 'BeginX', 'BeginY');
  transformCellPointPair(transformedCells, parentTransform, 'EndX', 'EndY');

  const pageShape = {
    ...shape,
    Cell: transformedCells
  };

  if (!isConnectorShape(pageShape)) {
    normalizeShapeBounds(cells, transformedCells, localToPageTransform);
  }

  return pageShape;
}

function transformCellPointPair(cells: any[], transform: PointTransform, xName: string, yName: string): void {
  const x = readCellNumber(cells, xName);
  const y = readCellNumber(cells, yName);
  if (x === undefined || y === undefined) {
    return;
  }

  const point = transform.toPage({ x, y });
  setCellNumber(cells, xName, point.x);
  setCellNumber(cells, yName, point.y);
}

function createLocalToPageTransform(shape: any, parentTransform?: PointTransform): PointTransform | undefined {
  const cells = toArray(shape?.Cell);
  const pinX = readCellNumber(cells, 'PinX');
  const pinY = readCellNumber(cells, 'PinY');
  const locPinX = readLocPin(cells, 'LocPinX', 'Width');
  const locPinY = readLocPin(cells, 'LocPinY', 'Height');
  if ([pinX, pinY, locPinX, locPinY].some(value => value === undefined)) {
    return parentTransform;
  }

  const angle = readCellNumber(cells, 'Angle') ?? 0;
  const flipX = readCellNumber(cells, 'FlipX') === 1;
  const flipY = readCellNumber(cells, 'FlipY') === 1;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    toPage(point: Point): Point {
      const localX = (flipX ? -1 : 1) * (point.x - locPinX!);
      const localY = (flipY ? -1 : 1) * (point.y - locPinY!);
      const parentPoint = {
        x: pinX! + localX * cos - localY * sin,
        y: pinY! + localX * sin + localY * cos
      };
      return parentTransform ? parentTransform.toPage(parentPoint) : parentPoint;
    }
  };
}

function normalizeShapeBounds(
  originalCells: any[],
  transformedCells: any[],
  localToPageTransform: PointTransform | undefined
): void {
  if (!localToPageTransform) {
    return;
  }

  const width = readCellNumber(originalCells, 'Width');
  const height = readCellNumber(originalCells, 'Height');
  if (width === undefined || height === undefined) {
    return;
  }

  const points = [
    localToPageTransform.toPage({ x: 0, y: 0 }),
    localToPageTransform.toPage({ x: width, y: 0 }),
    localToPageTransform.toPage({ x: width, y: height }),
    localToPageTransform.toPage({ x: 0, y: height })
  ];
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const bottom = Math.min(...ys);
  const top = Math.max(...ys);
  const normalizedWidth = right - left;
  const normalizedHeight = top - bottom;
  setCellNumber(transformedCells, 'PinX', (left + right) / 2);
  setCellNumber(transformedCells, 'PinY', (bottom + top) / 2);
  setCellNumber(transformedCells, 'Width', normalizedWidth);
  setCellNumber(transformedCells, 'Height', normalizedHeight);
  setCellNumber(transformedCells, 'LocPinX', normalizedWidth / 2);
  setCellNumber(transformedCells, 'LocPinY', normalizedHeight / 2);
  setCellNumber(transformedCells, 'Angle', 0);
}

function readLocPin(cells: unknown[], locPinName: string, sizeName: string): number | undefined {
  const locPin = readCellNumber(cells, locPinName);
  if (locPin !== undefined) {
    return locPin;
  }

  const size = readCellNumber(cells, sizeName);
  return size !== undefined ? size / 2 : undefined;
}

function isConnectorShape(shape: any): boolean {
  return String(shape?.OneD ?? '') === '1'
    || String(shape?.NameU ?? '').toLowerCase().includes('connector')
    || String(shape?.Name ?? '').includes('连接线')
    || hasConnectorEndpointCells(shape);
}

function hasConnectorEndpointCells(shape: any): boolean {
  const cells = toArray(shape?.Cell);
  return ['BeginX', 'BeginY', 'EndX', 'EndY'].every(name => readCellNumber(cells, name) !== undefined);
}

function ensureArrayProperty(target: any, key: string): any[] {
  const value = target[key];
  if (!value) {
    target[key] = [];
    return target[key];
  }
  if (Array.isArray(value)) {
    return value;
  }
  target[key] = [value];
  return target[key];
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function normalizedId(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const id = String(value).trim();
  return id.length > 0 ? id : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function validPageSize(value: number | undefined, fallback: number): number {
  return value !== undefined && value > 0 ? value : fallback;
}

function cleanNumber(value: unknown, fallback: number | undefined): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return fallback ?? 0;
}

function formatNumber(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}

function sortPageEntries(a: string, b: string): number {
  const aNumber = Number(a.match(/page(\d+)\.xml$/i)?.[1] ?? 0);
  const bNumber = Number(b.match(/page(\d+)\.xml$/i)?.[1] ?? 0);
  return aNumber - bNumber;
}
