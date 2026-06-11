import * as fs from 'fs/promises';
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
  const pageEntries = Object.keys(zip.files)
    .filter(name => /^visio\/pages\/page\d+\.xml$/i.test(name))
    .sort(sortPageEntries);
  const pages: VsdxEditorPage[] = [];
  const unsupportedNotes: string[] = [];

  for (const entry of pageEntries) {
    const file = zip.file(entry);
    if (!file) {
      continue;
    }

    const meta = pageMetadata.get(entry);
    const xml = await file.async('text');
    const parsed = xmlParser.parse(xml);
    const pageContents = parsed.PageContents ?? parsed['PageContents'];
    const shapes = toArray(pageContents?.Shapes?.Shape)
      .map(shape => toEditorShape(shape))
      .filter(isDefined);
    const unsupportedCount = shapes.filter(shape => !shape.editable).length;
    if (unsupportedCount > 0) {
      unsupportedNotes.push(`${meta?.name ?? entry}: ${unsupportedCount} shape(s) are shown as read-only because they use grouping, rotation, or incomplete geometry.`);
    }

    pages.push({
      id: meta?.id ?? entry,
      entry,
      name: meta?.name ?? entry.match(/page(\d+)\.xml$/i)?.[1] ?? entry,
      width: validPageSize(meta?.width, 8),
      height: validPageSize(meta?.height, 6),
      shapes
    });
  }

  return {
    sourceName,
    pages,
    unsupportedNotes
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

function toEditorShape(shape: any): VsdxEditorShape | undefined {
  const id = normalizedId(shape?.ID);
  if (!id) {
    return undefined;
  }

  const cells = toArray(shape?.Cell);
  const lineWeight = readCellNumber(cells, 'LineWeight');
  const angle = readCellNumber(cells, 'Angle') ?? 0;
  const hasChildShapes = toArray(shape?.Shapes?.Shape).length > 0;
  const isConnector = isConnectorShape(shape);
  const base = {
    id,
    name: String(shape?.Name ?? shape?.NameU ?? id),
    text: readShapeText(shape),
    fill: readCellString(cells, 'FillForegnd') ?? '#ffffff',
    line: readCellString(cells, 'LineColor') ?? '#586069',
    strokeWidth: Math.max(0.015, lineWeight ?? 0.02)
  };

  if (isConnector) {
    const beginX = readCellNumber(cells, 'BeginX');
    const beginY = readCellNumber(cells, 'BeginY');
    const endX = readCellNumber(cells, 'EndX');
    const endY = readCellNumber(cells, 'EndY');
    const editable = [beginX, beginY, endX, endY].every(value => value !== undefined) && !hasChildShapes;
    return {
      ...base,
      kind: 'connector',
      editable,
      reason: editable ? undefined : 'Connector endpoints are incomplete or nested.',
      beginX,
      beginY,
      endX,
      endY
    };
  }

  const pinX = readCellNumber(cells, 'PinX');
  const pinY = readCellNumber(cells, 'PinY');
  const width = readCellNumber(cells, 'Width');
  const height = readCellNumber(cells, 'Height');
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
    height
  };
}

function applyShapeUpdates(shapes: any[], updateById: Map<string, VsdxEditorShape>): void {
  for (const shape of shapes) {
    const id = normalizedId(shape?.ID);
    const update = id ? updateById.get(id) : undefined;
    if (update?.editable) {
      applyShapeUpdate(shape, update);
    }

    const childShapes = toArray(shape?.Shapes?.Shape);
    if (childShapes.length > 0) {
      applyShapeUpdates(childShapes, updateById);
    }
  }
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

function normalizePageEntry(target: string): string {
  const normalized = target.replace(/\\/g, '/').replace(/^\.\//, '');
  return normalized.startsWith('visio/pages/') ? normalized : `visio/pages/${normalized}`;
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
  if (shape?.Text === undefined || shape.Text === null) {
    return '';
  }
  if (typeof shape.Text === 'string') {
    return shape.Text;
  }
  if (typeof shape.Text?.['#text'] === 'string') {
    return shape.Text['#text'];
  }
  return String(shape.Text);
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
