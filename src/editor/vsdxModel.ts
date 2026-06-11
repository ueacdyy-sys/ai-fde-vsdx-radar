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
  allSections: any[];
  sections: any[];
  sourceWidth?: number;
  sourceHeight?: number;
}

interface GeometryContext {
  targetWidth: number;
  targetHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  scaleX: number;
  scaleY: number;
  scaleAverage: number;
  refs: Map<string, number>;
}

interface FormulaToken {
  type: 'number' | 'identifier' | 'operator' | 'paren' | 'comma';
  value: string;
}

interface PointTransform {
  toPage(point: Point): Point;
}

interface EditorShapeContext {
  modelId: string;
  masterShapes: Map<string, any>;
  imageDataUriByRelId: Map<string, string>;
  readOnlyReason?: string;
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
    const masterShape = readMasterShapeFor(shape, context.masterShapes);
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
      return;
    }

    const masterChildShapes = toArray(masterShape?.Shapes?.Shape);
    if (masterChildShapes.length > 0) {
      const masterTransform = createMasterToPageTransform(pageShape, masterShape);
      if (masterTransform) {
        collected.push(...collectEditorShapes(
          masterChildShapes,
          {
            ...context,
            readOnlyReason: 'Inherited master sub-shape is shown for preview and is not written back as a page shape.'
          },
          `${modelId}/master`,
          masterTransform
        ));
      }
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
  const readOnlyReason = context.readOnlyReason;
  const base = {
    id,
    name: String(shape?.Name ?? shape?.NameU ?? masterShape?.Name ?? masterShape?.NameU ?? id),
    text,
    fill: readFillColor(cells, masterCells),
    line: readLineColor(cells, masterCells),
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
    const editable = !readOnlyReason && [beginX, beginY, endX, endY].every(value => value !== undefined) && !hasChildShapes;
    return {
      ...base,
      kind: 'connector',
      editable,
      reason: editable ? undefined : readOnlyReason ?? 'Connector endpoints are incomplete or nested.',
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
  const editable = !readOnlyReason
    && [pinX, pinY, width, height].every(value => value !== undefined)
    && Math.abs(angle) < 0.0001
    && !hasChildShapes;
  return {
    ...base,
    kind: 'shape',
    editable,
    reason: editable ? undefined : readOnlyReason ?? 'Shape uses rotation, grouping, or incomplete geometry.',
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

function readFillColor(cells: unknown[], masterCells: unknown[]): string {
  const fillPattern = readCellNumber(cells, 'FillPattern') ?? readCellNumber(masterCells, 'FillPattern');
  if (fillPattern === 0) {
    return 'none';
  }
  return readColorCell(cells, 'FillForegnd')
    ?? readColorCell(masterCells, 'FillForegnd')
    ?? '#ffffff';
}

function readLineColor(cells: unknown[], masterCells: unknown[]): string {
  const linePattern = readCellNumber(cells, 'LinePattern') ?? readCellNumber(masterCells, 'LinePattern');
  if (linePattern === 0) {
    return 'none';
  }
  return readColorCell(cells, 'LineColor')
    ?? readColorCell(masterCells, 'LineColor')
    ?? '#586069';
}

function readColorCell(cells: unknown[], name: string): string | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === name) as any;
  if (!cell) {
    return undefined;
  }
  return normalizeColor(cell.V) ?? normalizeColor(cell.F);
}

function normalizeColor(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  const hex = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hex) {
    const normalized = hex[1].length === 3
      ? hex[1].split('').map(part => part + part).join('')
      : hex[1].slice(0, 6);
    return `#${normalized.toLowerCase()}`;
  }

  const rgb = trimmed.match(/RGB\s*\(\s*([^)]+)\)/i);
  if (rgb) {
    const parts = rgb[1].split(',').map(part => Number(part.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every(part => Number.isFinite(part))) {
      return `#${parts.slice(0, 3).map(toHexByte).join('')}`;
    }
  }
  return undefined;
}

function toHexByte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
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
    ...mergedGeometrySourcesFor(shape, masterShape, targetWidth, targetHeight),
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
  const sourceWidth = source.sourceWidth ?? readCellNumber(source.cells, 'Width') ?? targetWidth;
  const sourceHeight = source.sourceHeight ?? readCellNumber(source.cells, 'Height') ?? targetHeight;
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return undefined;
  }

  const context: GeometryContext = {
    targetWidth,
    targetHeight,
    sourceWidth,
    sourceHeight,
    scaleX: targetWidth / sourceWidth,
    scaleY: targetHeight / sourceHeight,
    scaleAverage: (Math.abs(targetWidth / sourceWidth) + Math.abs(targetHeight / sourceHeight)) / 2,
    refs: buildFormulaRefs(source, sourceWidth, sourceHeight)
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
      rememberGeometryRowRefs(section, row, cells, context);
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
  if (rowType === 'moveto' || rowType === 'relmoveto') {
    commands.push(pathCommand('M', point));
    return { firstPoint: point, lastPoint: point };
  }
  if (!lastPoint) {
    return undefined;
  }
  if (rowType === 'arcto' || rowType === 'relarcto') {
    const bow = (readGeometryCellNumber(cells, 'A', context) ?? 0) * (relative ? (context.targetWidth + context.targetHeight) / 2 : context.scaleAverage);
    const control = arcControlPoint(lastPoint, point, bow);
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
  const allSections = toArray(shape?.Section);
  const sections = allSections
    .filter(section => String(section?.N ?? '').toLowerCase() === 'geometry')
    .sort(sortGeometrySections);
  return sections.length > 0 ? [{ cells: toArray(shape?.Cell), allSections, sections }] : [];
}

function mergedGeometrySourcesFor(shape: any, masterShape: any, targetWidth: number, targetHeight: number): GeometrySource[] {
  if (!shape || !masterShape) {
    return [];
  }
  const pageSource = geometrySourcesFor(shape)[0];
  const masterSource = geometrySourcesFor(masterShape)[0];
  if (!pageSource || !masterSource) {
    return [];
  }

  const mergedAllSections = mergeShapeSections(masterSource.allSections, pageSource.allSections);
  const sections = mergedAllSections
    .filter(section => String(section?.N ?? '').toLowerCase() === 'geometry')
    .sort(sortGeometrySections);
  return sections.length > 0
    ? [{
      cells: mergeCells(masterSource.cells, pageSource.cells),
      allSections: mergedAllSections,
      sections,
      sourceWidth: targetWidth,
      sourceHeight: targetHeight
    }]
    : [];
}

function sortGeometrySections(a: any, b: any): number {
  return cleanNumber(a?.IX, 0) - cleanNumber(b?.IX, 0);
}

function mergeShapeSections(masterSections: any[], pageSections: any[]): any[] {
  const merged = new Map<string, any>();
  const order: string[] = [];
  masterSections.forEach((section, index) => {
    const key = sectionKey(section, index);
    merged.set(key, cloneXml(section));
    order.push(key);
  });
  pageSections.forEach((section, index) => {
    const key = sectionKey(section, index);
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, cloneXml(section));
      order.push(key);
      return;
    }
    merged.set(key, mergeSection(previous, section));
  });
  return order.map(key => merged.get(key)).filter(isDefined);
}

function mergeSection(masterSection: any, pageSection: any): any {
  const merged = {
    ...cloneXml(masterSection),
    ...cloneXml(pageSection)
  };
  const cells = mergeCells(toArray(masterSection?.Cell), toArray(pageSection?.Cell));
  const rows = mergeRows(toArray(masterSection?.Row), toArray(pageSection?.Row));
  if (cells.length > 0) {
    merged.Cell = cells;
  } else {
    delete merged.Cell;
  }
  if (rows.length > 0) {
    merged.Row = rows;
  } else {
    delete merged.Row;
  }
  return merged;
}

function mergeRows(masterRows: any[], pageRows: any[]): any[] {
  const merged = new Map<string, any>();
  const order: string[] = [];
  masterRows.forEach((row, index) => {
    const key = rowKey(row, index);
    merged.set(key, cloneXml(row));
    order.push(key);
  });
  pageRows.forEach((row, index) => {
    const key = rowKey(row, index);
    if (String(row?.Del ?? '') === '1') {
      merged.delete(key);
      return;
    }
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, cloneXml(row));
      order.push(key);
      return;
    }
    merged.set(key, {
      ...cloneXml(previous),
      ...cloneXml(row),
      Cell: mergeCells(toArray(previous?.Cell), toArray(row?.Cell))
    });
  });
  return order.map(key => merged.get(key)).filter(isDefined);
}

function mergeCells(masterCells: any[], pageCells: any[]): any[] {
  const merged = new Map<string, any>();
  const order: string[] = [];
  masterCells.forEach((cell, index) => {
    const key = cellKey(cell, index);
    merged.set(key, cloneXml(cell));
    order.push(key);
  });
  pageCells.forEach((cell, index) => {
    const key = cellKey(cell, index);
    if (!merged.has(key)) {
      order.push(key);
    }
    merged.set(key, {
      ...cloneXml(merged.get(key) ?? {}),
      ...cloneXml(cell)
    });
  });
  return order.map(key => merged.get(key)).filter(isDefined);
}

function sectionKey(section: any, index: number): string {
  return `${String(section?.N ?? '')}:${String(section?.IX ?? index)}`;
}

function rowKey(row: any, index: number): string {
  return `${String(row?.IX ?? index)}:${String(row?.N ?? row?.T ?? '')}`;
}

function cellKey(cell: any, index: number): string {
  return String(cell?.N ?? index);
}

function cloneXml<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function buildFormulaRefs(source: GeometrySource, sourceWidth: number, sourceHeight: number): Map<string, number> {
  const refs = new Map<string, number>();
  refs.set('width', sourceWidth);
  refs.set('height', sourceHeight);
  const context: GeometryContext = {
    targetWidth: sourceWidth,
    targetHeight: sourceHeight,
    sourceWidth,
    sourceHeight,
    scaleX: 1,
    scaleY: 1,
    scaleAverage: 1,
    refs
  };
  for (const cell of source.cells) {
    if (typeof cell?.N === 'string') {
      const value = evaluateFormula(cell.F, context) ?? Number(cell.V);
      if (Number.isFinite(value)) {
        refs.set(cell.N.toLowerCase(), value);
      }
    }
  }
  for (const [sectionIndex, section] of source.allSections.entries()) {
    for (const row of toArray(section?.Row)) {
      rememberSectionRowRefs(section, sectionIndex, row, toArray(row?.Cell), refs, context);
    }
  }
  return refs;
}

function rememberGeometryRowRefs(section: any, row: any, cells: any[], context: GeometryContext): void {
  rememberSectionRowRefs(section, cleanNumber(section?.IX, 0), row, cells, context.refs, context);
}

function rememberSectionRowRefs(
  section: any,
  sectionIndex: number,
  row: any,
  cells: any[],
  refs: Map<string, number>,
  context?: GeometryContext
): void {
  const rowNumber = rowNumberFor(row, 1);
  const sectionNames = sectionFormulaNames(section, sectionIndex);
  for (const cell of cells) {
    if (typeof cell?.N !== 'string') {
      continue;
    }
    const value = context ? readGeometryCellNumber(cells, cell.N, context) : Number(cell.V);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      continue;
    }
    for (const sectionName of sectionNames) {
      refs.set(`${sectionName}.${cell.N}${rowNumber}`.toLowerCase(), value);
    }
  }
}

function sectionFormulaNames(section: any, sectionIndex: number): string[] {
  const name = String(section?.N ?? '');
  if (name.toLowerCase() === 'geometry') {
    const ix = cleanNumber(section?.IX, sectionIndex);
    return [`Geometry${ix + 1}`, 'Geometry'];
  }
  return name ? [name] : [];
}

function rowNumberFor(row: any, fallback: number): number {
  return Math.max(1, Math.trunc(cleanNumber(row?.IX, fallback)));
}

function readGeometryCellNumber(cells: any[], name: string, context: GeometryContext): number | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === name);
  if (!cell) {
    return undefined;
  }
  const formulaValue = evaluateFormula(cell.F, context);
  if (formulaValue !== undefined) {
    return formulaValue;
  }
  const value = Number(cell.V);
  return Number.isFinite(value) ? value : undefined;
}

function readGeometryPoint(cells: any[], context: GeometryContext, relative: boolean, fallback?: Point): Point | undefined {
  const x = readGeometryCellNumber(cells, 'X', context) ?? fallback?.x;
  const y = readGeometryCellNumber(cells, 'Y', context) ?? fallback?.y;
  return x !== undefined && y !== undefined ? toGeometryPoint(x, y, context, relative) : undefined;
}

function readGeometryPointPair(cells: any[], xName: string, yName: string, context: GeometryContext, relative: boolean): Point | undefined {
  const x = readGeometryCellNumber(cells, xName, context);
  const y = readGeometryCellNumber(cells, yName, context);
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

function evaluateFormula(formula: unknown, context: GeometryContext): number | undefined {
  if (typeof formula !== 'string') {
    return undefined;
  }
  const trimmed = formula.trim();
  if (!trimmed || /^(inh|no formula)$/i.test(trimmed)) {
    return undefined;
  }

  const normalized = trimmed
    .replace(/^=/, '')
    .replace(/(\d+(?:\.\d+)?|\.\d+)(?:DL|IN|MM|CM|PT|FT)\b/gi, '$1');
  const tokens = tokenizeFormula(normalized);
  if (tokens.length === 0) {
    return undefined;
  }

  let index = 0;
  const peek = () => tokens[index];
  const consume = () => tokens[index++];

  const parseExpression = (): number | undefined => {
    let value = parseTerm();
    while (value !== undefined && peek()?.type === 'operator' && ['+', '-'].includes(peek().value)) {
      const operator = consume().value;
      const right = parseTerm();
      if (right === undefined) {
        return undefined;
      }
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };

  const parseTerm = (): number | undefined => {
    let value = parseFactor();
    while (value !== undefined && peek()?.type === 'operator' && ['*', '/'].includes(peek().value)) {
      const operator = consume().value;
      const right = parseFactor();
      if (right === undefined || (operator === '/' && Math.abs(right) < 0.0000001)) {
        return undefined;
      }
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };

  const parseFactor = (): number | undefined => {
    const token = peek();
    if (!token) {
      return undefined;
    }
    if (token.type === 'operator' && ['+', '-'].includes(token.value)) {
      consume();
      const value = parseFactor();
      return value === undefined ? undefined : token.value === '-' ? -value : value;
    }
    if (token.type === 'number') {
      consume();
      const value = Number(token.value);
      return Number.isFinite(value) ? value : undefined;
    }
    if (token.type === 'identifier') {
      const identifier = consume().value;
      if (peek()?.type === 'paren' && peek().value === '(') {
        consume();
        const args: number[] = [];
        if (!(peek()?.type === 'paren' && peek().value === ')')) {
          while (true) {
            const arg = parseExpression();
            if (arg === undefined) {
              return undefined;
            }
            args.push(arg);
            if (peek()?.type === 'comma') {
              consume();
              continue;
            }
            break;
          }
        }
        if (!(peek()?.type === 'paren' && peek().value === ')')) {
          return undefined;
        }
        consume();
        return applyFormulaFunction(identifier, args);
      }
      return resolveFormulaIdentifier(identifier, context);
    }
    if (token.type === 'paren' && token.value === '(') {
      consume();
      const value = parseExpression();
      if (!(peek()?.type === 'paren' && peek().value === ')')) {
        return undefined;
      }
      consume();
      return value;
    }
    return undefined;
  };

  const result = parseExpression();
  return result !== undefined && index === tokens.length && Number.isFinite(result) ? result : undefined;
}

function tokenizeFormula(formula: string): FormulaToken[] {
  const tokens: FormulaToken[] = [];
  let index = 0;
  while (index < formula.length) {
    const rest = formula.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }
    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/);
    if (number) {
      tokens.push({ type: 'number', value: number[0] });
      index += number[0].length;
      continue;
    }
    const identifier = rest.match(/^[A-Za-z_][A-Za-z0-9_.]*/);
    if (identifier) {
      tokens.push({ type: 'identifier', value: identifier[0] });
      index += identifier[0].length;
      continue;
    }
    const char = formula[index];
    if (['+', '-', '*', '/'].includes(char)) {
      tokens.push({ type: 'operator', value: char });
      index += 1;
      continue;
    }
    if (['(', ')'].includes(char)) {
      tokens.push({ type: 'paren', value: char });
      index += 1;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'comma', value: char });
      index += 1;
      continue;
    }
    return [];
  }
  return tokens;
}

function resolveFormulaIdentifier(identifier: string, context: GeometryContext): number | undefined {
  const normalized = identifier.toLowerCase();
  if (normalized === 'pi') {
    return Math.PI;
  }
  const value = context.refs.get(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function applyFormulaFunction(name: string, args: number[]): number | undefined {
  switch (name.toLowerCase()) {
    case 'guard':
    case 'themeguard':
    case 'setatref':
      return args[0];
    case 'abs':
      return args.length === 1 ? Math.abs(args[0]) : undefined;
    case 'min':
      return args.length > 0 ? Math.min(...args) : undefined;
    case 'max':
      return args.length > 0 ? Math.max(...args) : undefined;
    case 'sum':
      return args.reduce((total, value) => total + value, 0);
    case 'pi':
      return args.length === 0 ? Math.PI : undefined;
    default:
      return undefined;
  }
}

function splitFormulaArguments(args: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < args.length; index += 1) {
    const char = args[index];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
    } else if (char === ',' && depth === 0) {
      result.push(args.slice(start, index).trim());
      start = index + 1;
    }
  }
  const tail = args.slice(start).trim();
  if (tail) {
    result.push(tail);
  }
  return result;
}

function readFormulaPointList(cells: unknown[], name: string, context: GeometryContext, relative: boolean): Point[] {
  const formula = readCellFormula(cells, name) ?? readCellString(cells, name);
  const match = formula?.trim().match(/^[A-Z]+\((.*)\)$/i);
  if (!match) {
    return [];
  }

  const values = splitFormulaArguments(match[1])
    .map(argument => evaluateFormula(argument, context));
  if (values.length < 4 || values.length % 2 !== 0 || values.length > 80 || values.some(value => value === undefined)) {
    return [];
  }

  const points: Point[] = [];
  for (let index = 0; index < values.length; index += 2) {
    const x = values[index];
    const y = values[index + 1];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push(toGeometryPoint(x!, y!, context, relative));
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
    shape.Text = preserveTextFormattingMarkers(shape.Text, text);
    return;
  }
  shape.Text = text;
}

function preserveTextFormattingMarkers(value: Record<string, unknown>, text: string): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const key of ['cp', 'pp', 'tp']) {
    if (value[key] !== undefined) {
      next[key] = cloneXml(value[key]);
    }
  }
  next['#text'] = text;
  return next;
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

function createMasterToPageTransform(instanceShape: any, masterShape: any): PointTransform | undefined {
  const instanceCells = toArray(instanceShape?.Cell);
  const masterCells = toArray(masterShape?.Cell);
  const instanceWidth = readCellNumber(instanceCells, 'Width') ?? readCellNumber(masterCells, 'Width');
  const instanceHeight = readCellNumber(instanceCells, 'Height') ?? readCellNumber(masterCells, 'Height');
  const masterWidth = readCellNumber(masterCells, 'Width') ?? instanceWidth;
  const masterHeight = readCellNumber(masterCells, 'Height') ?? instanceHeight;
  const instanceTransform = createLocalToPageTransform(instanceShape);
  if (!instanceTransform || !instanceWidth || !instanceHeight || !masterWidth || !masterHeight) {
    return undefined;
  }

  return {
    toPage(point: Point): Point {
      return instanceTransform.toPage({
        x: point.x * (instanceWidth / masterWidth),
        y: point.y * (instanceHeight / masterHeight)
      });
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
