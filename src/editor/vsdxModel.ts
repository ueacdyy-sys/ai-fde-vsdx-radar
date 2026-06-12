import * as fs from 'fs/promises';
import * as path from 'path';
import JSZip from 'jszip';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { getVisioFormatSupport, type VisioFormatSupport } from '../visioFormats';

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
  formatSupport: VisioFormatSupport;
  readOnlyReason?: string;
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
  fillOpacity?: number;
  fillPattern?: number;
  fillBackground?: string;
  fillBackgroundOpacity?: number;
  line: string;
  strokeOpacity?: number;
  linePattern?: number;
  lineCap?: number;
  rounding?: number;
  shadow?: VsdxEditorShadow;
  strokeWidth: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  beginX?: number;
  beginY?: number;
  endX?: number;
  endY?: number;
  imageDataUri?: string;
  geometryPath?: string;
  textBox?: VsdxEditorTextBox;
  textStyle?: VsdxEditorTextStyle;
  beginArrow?: number;
  endArrow?: number;
  beginArrowSize?: number;
  endArrowSize?: number;
}

export interface VsdxEditorShadow {
  color: string;
  opacity: number;
  offsetX: number;
  offsetY: number;
  scale?: number;
}

export interface VsdxEditorTextBox {
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
}

export interface VsdxEditorTextStyle {
  color?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  horizontalAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  margins?: VsdxEditorTextMargins;
  background?: string;
  backgroundOpacity?: number;
}

export interface VsdxEditorTextMargins {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
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
  toLocal(point: Point): Point;
}

interface EditorShapeContext {
  modelId: string;
  masterShapes: Map<string, MasterShapeEntry>;
  styleSheets: StyleSheetContext;
  imageDataUriByRelId: Map<string, string>;
  readOnlyReason?: string;
  formulaRefs?: Map<string, number>;
}

interface MasterShapeEntry {
  shape: any;
  shapes: any[];
  imageDataUriByRelId: Map<string, string>;
}

type StyleCategory = 'line' | 'fill' | 'text';

interface StyleSheetContext {
  byId: Map<string, StyleSheetEntry>;
  resolvedCellCache: Map<string, any[]>;
  resolvedSectionCache: Map<string, any[]>;
}

interface StyleSheetEntry {
  id: string;
  lineStyleId?: string;
  fillStyleId?: string;
  textStyleId?: string;
  cells: any[];
  sections: any[];
}

const legacyXmlCellNames = new Set([
  'PinX',
  'PinY',
  'Width',
  'Height',
  'LocPinX',
  'LocPinY',
  'Angle',
  'FlipX',
  'FlipY',
  'BeginX',
  'BeginY',
  'EndX',
  'EndY',
  'LineWeight',
  'LineColor',
  'LinePattern',
  'LineCap',
  'Rounding',
  'BeginArrowSize',
  'EndArrowSize',
  'FillForegnd',
  'FillBkgnd',
  'FillPattern',
  'FillForegndTrans',
  'FillBkgndTrans',
  'ShdwForegnd',
  'ShdwForegndTrans',
  'ShdwPattern',
  'ShapeShdwType',
  'ShapeShdwShow',
  'ShapeShdwBlur',
  'ShapeShdwOffsetX',
  'ShapeShdwOffsetY',
  'ShapeShdwScaleFactor',
  'Color',
  'Char.Color',
  'Size',
  'Style',
  'HAlign',
  'HorzAlign',
  'VerticalAlign',
  'LeftMargin',
  'RightMargin',
  'TopMargin',
  'BottomMargin',
  'TextBkgnd',
  'TextBkgndTrans',
  'TxtPinX',
  'TxtPinY',
  'TxtWidth',
  'TxtHeight',
  'TxtLocPinX',
  'TxtLocPinY',
  'TxtAngle',
  'PageWidth',
  'PageHeight'
]);

const legacyXmlGeometryCellNames = new Set(['X', 'Y', 'A', 'B', 'C', 'D', 'E']);
const legacyXmlGeometryRowNames = new Set([
  'MoveTo',
  'LineTo',
  'ArcTo',
  'EllipticalArcTo',
  'QuadBezTo',
  'CubBezTo',
  'PolylineTo',
  'NURBSTo',
  'SplineStart',
  'SplineKnot',
  'Ellipse',
  'InfiniteLine',
  'RelMoveTo',
  'RelLineTo',
  'RelArcTo',
  'RelEllipticalArcTo',
  'RelQuadBezTo',
  'RelCubBezTo',
  'RelPolylineTo'
]);

const lineStyleCellNames = new Set([
  'LineWeight',
  'LineColor',
  'LinePattern',
  'LineCap',
  'LineColorTrans',
  'BeginArrow',
  'EndArrow',
  'BeginArrowSize',
  'EndArrowSize',
  'Rounding'
]);

const fillStyleCellNames = new Set([
  'FillForegnd',
  'FillBkgnd',
  'FillPattern',
  'FillForegndTrans',
  'FillBkgndTrans',
  'ShdwForegnd',
  'ShdwBkgnd',
  'ShdwPattern',
  'ShdwForegndTrans',
  'ShapeShdwType',
  'ShapeShdwShow',
  'ShapeShdwBlur',
  'ShapeShdwOffsetX',
  'ShapeShdwOffsetY',
  'ShapeShdwScaleFactor'
]);

const textStyleCellNames = new Set([
  'Color',
  'Char.Color',
  'Font',
  'Size',
  'Style',
  'HAlign',
  'HorzAlign',
  'VerticalAlign',
  'LeftMargin',
  'RightMargin',
  'TopMargin',
  'BottomMargin',
  'TextPosAfterBullet',
  'TextBkgnd',
  'TextBkgndTrans',
  'TxtPinX',
  'TxtPinY',
  'TxtWidth',
  'TxtHeight',
  'TxtLocPinX',
  'TxtLocPinY',
  'TxtAngle'
]);

export async function readVsdxDiagramFromFile(filePath: string): Promise<{ bytes: Buffer; diagram: VsdxEditorDiagram }> {
  const bytes = await fs.readFile(filePath);
  return {
    bytes,
    diagram: await readVsdxDiagram(bytes, filePath)
  };
}

export async function readVsdxDiagram(bytes: Buffer, sourceName: string): Promise<VsdxEditorDiagram> {
  const formatSupport = getVisioFormatSupport(sourceName);
  if (formatSupport === 'legacy-binary') {
    return createUnsupportedVisioDiagram(
      sourceName,
      'Legacy binary Visio files (.vsd/.vss/.vst) are recognized. Convert this file to a modern Visio package (.vsdx/.vssx/.vstx) to unlock semantic preview, zoom, text edits, shape dragging, and connector dragging.'
    );
  }
  if (formatSupport === 'legacy-opaque') {
    return createUnsupportedVisioDiagram(
      sourceName,
      'This legacy Visio container is recognized. Convert it to a modern Visio package (.vsdx/.vssx/.vstx) to unlock semantic preview, zoom, text edits, shape dragging, and connector dragging.'
    );
  }
  if (formatSupport === 'legacy-xml') {
    return readLegacyXmlDiagram(bytes, sourceName);
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (error) {
    return createUnsupportedVisioDiagram(
      sourceName,
      `This file could not be opened as a modern Visio package: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const styleSheets = await readStyleSheets(zip);
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
    const pageWidth = validPageSize(meta?.width, 8);
    const pageHeight = validPageSize(meta?.height, 6);
    const shapes = collectEditorShapes(toArray(pageContents?.Shapes?.Shape), {
      masterShapes,
      styleSheets,
      imageDataUriByRelId,
      formulaRefs: createPageFormulaRefs(pageWidth, pageHeight)
    });
    const unsupportedCount = shapes.filter(shape => !shape.editable).length;
    const page = {
      id: meta?.id ?? entry,
      entry,
      name: meta?.name ?? entry.match(/page(\d+)\.xml$/i)?.[1] ?? entry,
      width: pageWidth,
      height: pageHeight,
      shapes
    };
    const unsupportedNote = unsupportedCount > 0
      ? `${page.name}: ${unsupportedCount} shape(s) are shown as read-only because they use grouping or incomplete geometry.`
      : undefined;
    return { page, unsupportedNote };
  }));

  const pages = pageResults.map(result => result?.page).filter(isDefined);
  const unsupportedNotes = pageResults.map(result => result?.unsupportedNote).filter(isDefined);
  if (pages.length === 0 && masterShapes.size > 0) {
    const masterPages = createMasterPreviewPages(masterShapes, styleSheets);
    return {
      sourceName,
      formatSupport: 'modern-package',
      readOnlyReason: 'This Visio package has no regular page XML. Master shapes are shown as read-only preview pages.',
      pages: masterPages,
      unsupportedNotes: [
        'No regular Visio page XML entries were found. Showing read-only master/stencil previews instead.',
        ...unsupportedNotes
      ]
    };
  }

  return {
    sourceName,
    formatSupport: 'modern-package',
    pages,
    unsupportedNotes
  };
}

function readLegacyXmlDiagram(bytes: Buffer, sourceName: string): VsdxEditorDiagram {
  let parsed: any;
  try {
    parsed = xmlParser.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    return createUnsupportedVisioDiagram(
      sourceName,
      `This Visio XML file could not be parsed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const document = parsed?.VisioDocument ?? parsed?.['VisioDocument'];
  if (!document) {
    return createUnsupportedVisioDiagram(sourceName, 'This Visio XML file does not contain a VisioDocument root element.');
  }

  const styleSheets = readStyleSheetsFromDocument(document);
  const masterShapes = readLegacyXmlMasterShapes(document);
  const pageResults = toArray(document?.Pages?.Page).map((page, index) => {
    const normalized = normalizeLegacyXmlPage(page, index);
    const pageWidth = validPageSize(normalized.width, 8);
    const pageHeight = validPageSize(normalized.height, 6);
    const shapes = collectEditorShapes(toArray(normalized.pageContents?.Shapes?.Shape), {
      masterShapes,
      styleSheets,
      imageDataUriByRelId: new Map(),
      formulaRefs: createPageFormulaRefs(pageWidth, pageHeight)
    });
    const unsupportedCount = shapes.filter(shape => !shape.editable).length;
    const pageResult = {
      id: normalized.id,
      entry: normalized.entry,
      name: normalized.name,
      width: pageWidth,
      height: pageHeight,
      shapes
    };
    const unsupportedNote = unsupportedCount > 0
      ? `${pageResult.name}: ${unsupportedCount} shape(s) are shown as read-only because they use grouping or incomplete geometry.`
      : undefined;
    return { page: pageResult, unsupportedNote };
  });

  const pages = pageResults.map(result => result.page);
  const unsupportedNotes = pageResults.map(result => result.unsupportedNote).filter(isDefined);
  if (pages.length === 0 && masterShapes.size > 0) {
    return {
      sourceName,
      formatSupport: 'legacy-xml',
      readOnlyReason: 'This Visio XML stencil/template has no regular pages. Master shapes are shown as read-only preview pages.',
      pages: createMasterPreviewPages(masterShapes, styleSheets),
      unsupportedNotes: [
        'No regular Visio XML pages were found. Showing read-only master/stencil previews instead.',
        ...unsupportedNotes
      ]
    };
  }

  return {
    sourceName,
    formatSupport: 'legacy-xml',
    pages,
    unsupportedNotes
  };
}

function readLegacyXmlMasterShapes(document: any): Map<string, MasterShapeEntry> {
  const masterShapes = new Map<string, MasterShapeEntry>();
  for (const master of toArray(document?.Masters?.Master)) {
    const id = normalizedId(master?.ID);
    const firstShape = toArray(master?.Shapes?.Shape)[0] ?? master?.Shape;
    if (!id || !firstShape) {
      continue;
    }

    masterShapes.set(id, {
      shape: {
        ...normalizeLegacyXmlShape(firstShape),
        Name: master?.Name ?? firstShape?.Name,
        NameU: master?.NameU ?? firstShape?.NameU
      },
      shapes: toArray(master?.Shapes?.Shape).map(normalizeLegacyXmlShape),
      imageDataUriByRelId: new Map()
    });
  }
  return masterShapes;
}

function normalizeLegacyXmlPage(page: any, index: number): {
  id: string;
  entry: string;
  name: string;
  width?: number;
  height?: number;
  pageContents: any;
} {
  const pageCells = collectLegacyXmlCells(page?.PageSheet, legacyXmlCellNames);
  return {
    id: normalizedId(page?.ID) ?? `page-${index + 1}`,
    entry: legacyXmlPageEntry(page, index),
    name: String(page?.Name ?? page?.NameU ?? `Page-${index + 1}`),
    width: readCellNumber(pageCells, 'PageWidth'),
    height: readCellNumber(pageCells, 'PageHeight'),
    pageContents: {
      Shapes: {
        Shape: toArray(page?.Shapes?.Shape).map(normalizeLegacyXmlShape)
      }
    }
  };
}

function legacyXmlPageEntry(page: any, index: number): string {
  return `xml/pages/${normalizedId(page?.ID) ?? index + 1}`;
}

function normalizeLegacyXmlShape(shape: any): any {
  const normalized = cloneXml(shape);
  normalized.Cell = mergeCells(
    toArray(normalized?.Cell),
    collectLegacyXmlCells(shape, legacyXmlCellNames)
  );

  const geometrySections = legacyXmlGeometrySections(shape);
  if (geometrySections.length > 0) {
    normalized.Section = [
      ...toArray(normalized?.Section),
      ...geometrySections
    ];
  }

  const childShapes = toArray(shape?.Shapes?.Shape);
  if (childShapes.length > 0) {
    normalized.Shapes = {
      ...normalized.Shapes,
      Shape: childShapes.map(normalizeLegacyXmlShape)
    };
  }

  return normalized;
}

function collectLegacyXmlCells(source: any, names: Set<string>): any[] {
  if (!source || typeof source !== 'object') {
    return [];
  }

  const cells: any[] = [];
  const groups = [
    source,
    source.XForm,
    source.XForm1D,
    source.Line,
    source.Fill,
    source.Char,
    source.Character,
    source.Para,
    source.Paragraph,
    source.TextBlock,
    source.TextXForm,
    source.PageProps,
    source.Layout,
    source.Misc,
    source.ShapeLayout
  ].filter(isDefined).flatMap(group => toArray(group as any));

  for (const group of groups) {
    if (!group || typeof group !== 'object') {
      continue;
    }
    for (const [key, value] of Object.entries(group)) {
      if (!names.has(key)) {
        continue;
      }
      const cell = legacyXmlElementToCell(key, value);
      if (cell) {
        cells.push(cell);
      }
    }
  }

  return mergeCells([], cells);
}

function legacyXmlElementToCell(name: string, value: unknown): any | undefined {
  const text = readLegacyXmlElementValue(value);
  const formula = readLegacyXmlElementFormula(value);
  if (text === undefined && formula === undefined) {
    return undefined;
  }

  const cell: any = { N: name };
  if (text !== undefined) {
    cell.V = text;
  }
  if (formula !== undefined) {
    cell.F = formula;
  }
  return cell;
}

function readLegacyXmlElementValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return readLegacyXmlElementValue(value[0]);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['V', '#text']) {
      const nested = record[key];
      if (typeof nested === 'string' || typeof nested === 'number' || typeof nested === 'boolean') {
        return String(nested);
      }
    }
  }
  return undefined;
}

function readLegacyXmlElementFormula(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const formula = (value as Record<string, unknown>).F;
  return typeof formula === 'string' && formula.trim().length > 0 ? formula : undefined;
}

function legacyXmlGeometrySections(shape: any): any[] {
  return toArray(shape?.Geom).map((geom, index) => {
    const rows: any[] = [];
    for (const [key, value] of Object.entries(geom ?? {})) {
      if (!legacyXmlGeometryRowNames.has(key)) {
        continue;
      }
      for (const row of toArray(value as any)) {
        const cells = collectLegacyXmlCells(row, legacyXmlGeometryCellNames);
        if (cells.length > 0) {
          rows.push({
            T: key,
            IX: String((row as any)?.IX ?? rows.length + 1),
            Del: (row as any)?.Del,
            Cell: cells
          });
        }
      }
    }

    return {
      N: 'Geometry',
      IX: String((geom as any)?.IX ?? index),
      Row: rows
    };
  }).filter(section => section.Row.length > 0);
}

export function createUnsupportedVisioDiagram(sourceName: string, reason: string): VsdxEditorDiagram {
  return {
    sourceName,
    formatSupport: getVisioFormatSupport(sourceName),
    readOnlyReason: reason,
    pages: [{
      id: 'unsupported',
      entry: '__unsupported__',
      name: path.basename(sourceName),
      width: 8.5,
      height: 6,
      shapes: [{
        id: 'unsupported-message',
        kind: 'shape',
        name: 'Unsupported Visio format',
        text: reason,
        editable: false,
        reason,
        fill: '#fff7ed',
        line: '#d97706',
        strokeWidth: 0.03,
        x: 0.75,
        y: 2.1,
        width: 7,
        height: 1.8
      }]
    }],
    unsupportedNotes: [reason]
  };
}

function createMasterPreviewPages(masterShapes: Map<string, MasterShapeEntry>, styleSheets: StyleSheetContext): VsdxEditorPage[] {
  return Array.from(masterShapes.entries()).map(([masterId, masterEntry], index) => {
    const masterShape = masterEntry.shape;
    const previewShape = normalizeMasterPreviewShape(masterShape, masterId);
    const cells = toArray(previewShape?.Cell);
    const width = validPageSize(readCellNumber(cells, 'Width'), 2);
    const height = validPageSize(readCellNumber(cells, 'Height'), 1.2);
    const pageWidth = Math.max(3, width + 1);
    const pageHeight = Math.max(2.2, height + 1);
    const shapes = collectEditorShapes([previewShape], {
      masterShapes: new Map(),
      styleSheets,
      imageDataUriByRelId: masterEntry.imageDataUriByRelId,
      readOnlyReason: 'Stencil/template master shapes are shown for preview and are not written back as page shapes.'
    });

    return {
      id: `master-${masterId}`,
      entry: `__master__/${masterId}`,
      name: String(previewShape?.Name ?? previewShape?.NameU ?? `Master ${index + 1}`),
      width: pageWidth,
      height: pageHeight,
      shapes
    };
  });
}

function normalizeMasterPreviewShape(masterShape: any, masterId: string): any {
  const shape = cloneXml(masterShape);
  shape.ID = normalizedId(shape?.ID) ?? masterId;
  const cells = ensureArrayProperty(shape, 'Cell');
  const width = validPageSize(readCellNumber(cells, 'Width'), 2);
  const height = validPageSize(readCellNumber(cells, 'Height'), 1.2);
  setCellNumber(cells, 'Width', width);
  setCellNumber(cells, 'Height', height);
  setCellNumber(cells, 'PinX', width / 2 + 0.5);
  setCellNumber(cells, 'PinY', height / 2 + 0.5);
  setCellNumber(cells, 'LocPinX', width / 2);
  setCellNumber(cells, 'LocPinY', height / 2);
  return shape;
}

export async function writeVsdxDiagramToFile(filePath: string, sourceBytes: Buffer, diagram: VsdxEditorDiagram): Promise<Buffer> {
  const bytes = await writeVsdxDiagram(sourceBytes, diagram);
  await fs.writeFile(filePath, bytes);
  return bytes;
}

export async function writeVsdxDiagram(sourceBytes: Buffer, diagram: VsdxEditorDiagram): Promise<Buffer> {
  if (diagram.formatSupport === 'legacy-xml') {
    return writeLegacyXmlDiagram(sourceBytes, diagram);
  }
  if (diagram.formatSupport !== 'modern-package' || diagram.pages.every(page => page.entry.startsWith('__'))) {
    return Buffer.from(sourceBytes);
  }

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
    zip.file(entry, buildXmlDocument(parsed));
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
    const masterEntry = readMasterEntryFor(shape, context.masterShapes);
    const masterShape = masterEntry?.shape;
    const masterImageDataUriByRelId = masterEntry?.imageDataUriByRelId ?? new Map();
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

    const masterChildShapes = masterEntry ? inheritedMasterPreviewShapes(masterEntry) : [];
    if (masterChildShapes.length > 0) {
      const masterTransform = createMasterToPageTransform(pageShape, masterShape);
      if (masterTransform) {
        collected.push(...collectEditorShapes(
          masterChildShapes,
          {
            ...context,
            imageDataUriByRelId: masterImageDataUriByRelId,
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
  const masterStyleCells = styleCellsForShape(masterShape, context.styleSheets);
  const pageStyleCells = styleCellsForShape(shape, context.styleSheets);
  const effectiveCells = mergeEffectiveCellLayers(masterStyleCells, masterCells, pageStyleCells, cells);
  const effectiveSections = mergeEffectiveSections(
    styleSectionsForShape(masterShape, context.styleSheets),
    toArray(masterShape?.Section),
    styleSectionsForShape(shape, context.styleSheets),
    toArray(shape?.Section)
  );
  const shapeFormulaRefs = createShapeFormulaRefs(effectiveCells, context.formulaRefs);
  const lineWeight = readCellNumber(effectiveCells, 'LineWeight', shapeFormulaRefs);
  const linePattern = readCellNumber(effectiveCells, 'LinePattern', shapeFormulaRefs);
  const lineCap = readCellNumber(effectiveCells, 'LineCap', shapeFormulaRefs);
  const rounding = readRoundingCell(effectiveCells, shapeFormulaRefs);
  const beginArrow = readCellNumber(effectiveCells, 'BeginArrow', shapeFormulaRefs);
  const endArrow = readCellNumber(effectiveCells, 'EndArrow', shapeFormulaRefs);
  const beginArrowSize = readCellNumber(effectiveCells, 'BeginArrowSize', shapeFormulaRefs);
  const endArrowSize = readCellNumber(effectiveCells, 'EndArrowSize', shapeFormulaRefs);
  const fillPattern = readCellNumber(effectiveCells, 'FillPattern', shapeFormulaRefs);
  const angle = readCellNumber(effectiveCells, 'Angle', shapeFormulaRefs) ?? 0;
  const textBox = readTextBox(effectiveCells, shapeFormulaRefs);
  const textStyle = readTextStyle(effectiveCells, effectiveSections, shapeFormulaRefs);
  const shadow = readShadowStyle(effectiveCells, shapeFormulaRefs);
  const hasChildShapes = toArray(shape?.Shapes?.Shape).length > 0;
  const isConnector = isConnectorShape(shape) || isConnectorShape(masterShape);
  const text = readShapeText(shape) || readShapeText(masterShape);
  const masterImageDataUriByRelId = readMasterImageDataUriByRelIdFor(shape, context.masterShapes);
  const imageDataUri = readShapeImageDataUri(shape, context.imageDataUriByRelId)
    ?? readShapeImageDataUri(masterShape, masterImageDataUriByRelId);
  const readOnlyReason = context.readOnlyReason;
  const base = {
    id,
    name: String(shape?.Name ?? shape?.NameU ?? masterShape?.Name ?? masterShape?.NameU ?? id),
    text,
    fill: readFillColor(effectiveCells),
    fillOpacity: readOpacityCell(effectiveCells, 'FillForegndTrans', shapeFormulaRefs),
    fillPattern,
    fillBackground: readFillBackgroundColor(effectiveCells),
    fillBackgroundOpacity: readOpacityCell(effectiveCells, 'FillBkgndTrans', shapeFormulaRefs),
    line: readLineColor(effectiveCells),
    strokeOpacity: readOpacityCell(effectiveCells, 'LineColorTrans', shapeFormulaRefs),
    linePattern,
    lineCap,
    rounding,
    shadow,
    beginArrowSize,
    endArrowSize,
    strokeWidth: Math.max(0.015, lineWeight ?? 0.02)
  };
  if (textBox) {
    (base as typeof base & { textBox: VsdxEditorTextBox }).textBox = textBox;
  }
  if (textStyle) {
    (base as typeof base & { textStyle: VsdxEditorTextStyle }).textStyle = textStyle;
  }

  if (isConnector) {
    const beginX = readCellNumber(cells, 'BeginX', shapeFormulaRefs);
    const beginY = readCellNumber(cells, 'BeginY', shapeFormulaRefs);
    const endX = readCellNumber(cells, 'EndX', shapeFormulaRefs);
    const endY = readCellNumber(cells, 'EndY', shapeFormulaRefs);
    const pinX = readCellNumber(cells, 'PinX', shapeFormulaRefs);
    const pinY = readCellNumber(cells, 'PinY', shapeFormulaRefs);
    const width = readCellNumber(effectiveCells, 'Width', shapeFormulaRefs);
    const height = readCellNumber(effectiveCells, 'Height', shapeFormulaRefs);
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
      beginArrow,
      endArrow,
      geometryPath
    };
  }

  const pinX = readCellNumber(cells, 'PinX', shapeFormulaRefs);
  const pinY = readCellNumber(cells, 'PinY', shapeFormulaRefs);
  const width = readCellNumber(effectiveCells, 'Width', shapeFormulaRefs);
  const height = readCellNumber(effectiveCells, 'Height', shapeFormulaRefs);
  const geometryPath = width !== undefined && height !== undefined
    ? compileGeometryPath(shape, masterShape, width, height)
    : undefined;
  const editable = !readOnlyReason
    && [pinX, pinY, width, height].every(value => value !== undefined)
    && !hasChildShapes;
  return {
    ...base,
    kind: 'shape',
    editable,
    reason: editable ? undefined : readOnlyReason ?? 'Shape uses grouping or incomplete geometry.',
    x: pinX !== undefined && width !== undefined ? pinX - width / 2 : undefined,
    y: pinY !== undefined && height !== undefined ? pinY - height / 2 : undefined,
    width,
    height,
    angle,
    imageDataUri,
    geometryPath
  };
}

function applyShapeUpdates(
  shapes: any[],
  updateById: Map<string, VsdxEditorShape>,
  parentPath = '',
  parentTransform?: PointTransform
): void {
  const idCounts = countShapeIds(shapes);
  const seenIds = new Map<string, number>();

  shapes.forEach((shape, index) => {
    const id = createModelShapeId(shape, index, parentPath, idCounts, seenIds);
    const update = id ? updateById.get(id) : undefined;
    if (update?.editable) {
      applyShapeUpdate(shape, update, parentTransform);
    }

    const childShapes = toArray(shape?.Shapes?.Shape);
    if (childShapes.length > 0) {
      applyShapeUpdates(childShapes, updateById, id, createLocalToPageTransform(shape, parentTransform));
    }
  });
}

function applyLegacyXmlShapeUpdates(
  shapes: any[],
  updateById: Map<string, VsdxEditorShape>,
  parentPath = '',
  parentTransform?: PointTransform
): void {
  const idCounts = countShapeIds(shapes);
  const seenIds = new Map<string, number>();

  shapes.forEach((shape, index) => {
    const id = createModelShapeId(shape, index, parentPath, idCounts, seenIds);
    const update = id ? updateById.get(id) : undefined;
    if (update?.editable) {
      applyLegacyXmlShapeUpdate(shape, update, parentTransform);
    }

    const childShapes = toArray(shape?.Shapes?.Shape);
    if (childShapes.length > 0) {
      applyLegacyXmlShapeUpdates(childShapes, updateById, id, createLocalToPageTransform(shape, parentTransform));
    }
  });
}

function writeLegacyXmlDiagram(sourceBytes: Buffer, diagram: VsdxEditorDiagram): Buffer {
  if (diagram.pages.every(page => page.entry.startsWith('__'))) {
    return Buffer.from(sourceBytes);
  }

  let parsed: any;
  try {
    parsed = xmlParser.parse(sourceBytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    return Buffer.from(sourceBytes);
  }

  const document = parsed?.VisioDocument ?? parsed?.['VisioDocument'];
  if (!document) {
    return Buffer.from(sourceBytes);
  }

  const pageByEntry = new Map(diagram.pages.map(page => [page.entry, page]));
  toArray(document?.Pages?.Page).forEach((page, index) => {
    const entry = legacyXmlPageEntry(page, index);
    const updatedPage = pageByEntry.get(entry);
    if (!updatedPage) {
      return;
    }

    const updateById = new Map(updatedPage.shapes.map(shape => [shape.id, shape]));
    applyLegacyXmlShapeUpdates(toArray(page?.Shapes?.Shape), updateById);
  });

  return Buffer.from(buildXmlDocument(parsed), 'utf8');
}

function buildXmlDocument(parsed: any): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${stripLeadingXmlDeclarations(xmlBuilder.build(parsed))}`;
}

function stripLeadingXmlDeclarations(xml: string): string {
  let body = xml.replace(/^\uFEFF/, '').trimStart();
  while (/^<\?xml\b/i.test(body)) {
    body = body.replace(/^<\?xml[\s\S]*?\?>\s*/i, '');
  }
  return body;
}

function applyShapeUpdate(shape: any, update: VsdxEditorShape, parentTransform?: PointTransform): void {
  const cells = ensureArrayProperty(shape, 'Cell');
  if (update.kind === 'connector') {
    const begin = toWriteLocalPoint({
      x: cleanNumber(update.beginX, 0),
      y: cleanNumber(update.beginY, 0)
    }, parentTransform);
    const end = toWriteLocalPoint({
      x: cleanNumber(update.endX, 0),
      y: cleanNumber(update.endY, 0)
    }, parentTransform);
    setCellNumber(cells, 'BeginX', begin.x);
    setCellNumber(cells, 'BeginY', begin.y);
    setCellNumber(cells, 'EndX', end.x);
    setCellNumber(cells, 'EndY', end.y);
    syncConnectorGeometry(shape, cells, begin, end);
    writeShapeText(shape, update.text);
    return;
  }

  const pageWidth = Math.max(0.05, cleanNumber(update.width, 1));
  const pageHeight = Math.max(0.05, cleanNumber(update.height, 0.6));
  const { width, height } = resolveShapeWriteSize(shape, update, parentTransform);
  const center = toWriteLocalPoint({
    x: cleanNumber(update.x, 0) + pageWidth / 2,
    y: cleanNumber(update.y, 0) + pageHeight / 2
  }, parentTransform);
  setCellNumber(cells, 'PinX', center.x);
  setCellNumber(cells, 'PinY', center.y);
  setCellNumber(cells, 'Width', width);
  setCellNumber(cells, 'Height', height);
  setCellNumber(cells, 'LocPinX', width / 2);
  setCellNumber(cells, 'LocPinY', height / 2);
  writeShapeText(shape, update.text);
}

function applyLegacyXmlShapeUpdate(shape: any, update: VsdxEditorShape, parentTransform?: PointTransform): void {
  if (update.kind === 'connector') {
    const begin = toWriteLocalPoint({
      x: cleanNumber(update.beginX, 0),
      y: cleanNumber(update.beginY, 0)
    }, parentTransform);
    const end = toWriteLocalPoint({
      x: cleanNumber(update.endX, 0),
      y: cleanNumber(update.endY, 0)
    }, parentTransform);
    setLegacyXmlCellNumber(shape, 'BeginX', begin.x, 'XForm1D');
    setLegacyXmlCellNumber(shape, 'BeginY', begin.y, 'XForm1D');
    setLegacyXmlCellNumber(shape, 'EndX', end.x, 'XForm1D');
    setLegacyXmlCellNumber(shape, 'EndY', end.y, 'XForm1D');
    rewriteLegacyXmlConnectorGeometry(shape, begin, end);
    writeShapeText(shape, update.text);
    return;
  }

  const pageWidth = Math.max(0.05, cleanNumber(update.width, 1));
  const pageHeight = Math.max(0.05, cleanNumber(update.height, 0.6));
  const { width, height } = resolveShapeWriteSize(shape, update, parentTransform);
  const center = toWriteLocalPoint({
    x: cleanNumber(update.x, 0) + pageWidth / 2,
    y: cleanNumber(update.y, 0) + pageHeight / 2
  }, parentTransform);
  setLegacyXmlCellNumber(shape, 'PinX', center.x, 'XForm');
  setLegacyXmlCellNumber(shape, 'PinY', center.y, 'XForm');
  setLegacyXmlCellNumber(shape, 'Width', width, 'XForm');
  setLegacyXmlCellNumber(shape, 'Height', height, 'XForm');
  setLegacyXmlCellNumber(shape, 'LocPinX', width / 2, 'XForm');
  setLegacyXmlCellNumber(shape, 'LocPinY', height / 2, 'XForm');
  writeShapeText(shape, update.text);
}

function toWriteLocalPoint(point: Point, parentTransform?: PointTransform): Point {
  return parentTransform ? parentTransform.toLocal(point) : point;
}

function nearlyEqual(left: number, right: number, tolerance = 0.0001): boolean {
  return Math.abs(left - right) < tolerance;
}

function resolveShapeWriteSize(
  shape: any,
  update: VsdxEditorShape,
  parentTransform?: PointTransform
): { width: number; height: number } {
  const requestedWidth = Math.max(0.05, cleanNumber(update.width, 1));
  const requestedHeight = Math.max(0.05, cleanNumber(update.height, 0.6));
  if (!parentTransform) {
    return { width: requestedWidth, height: requestedHeight };
  }

  const localCells = shapeTransformCells(shape);
  const formulaRefs = createShapeFormulaRefs(localCells);
  const localWidth = readCellNumber(localCells, 'Width', formulaRefs);
  const localHeight = readCellNumber(localCells, 'Height', formulaRefs);
  if (localWidth === undefined || localHeight === undefined) {
    return { width: requestedWidth, height: requestedHeight };
  }

  const currentPageBounds = transformedLocalBounds(localWidth, localHeight, createLocalToPageTransform(shape, parentTransform));
  if (
    currentPageBounds
    && nearlyEqual(requestedWidth, currentPageBounds.width)
    && nearlyEqual(requestedHeight, currentPageBounds.height)
  ) {
    return { width: Math.max(0.05, localWidth), height: Math.max(0.05, localHeight) };
  }

  const left = cleanNumber(update.x, 0);
  const bottom = cleanNumber(update.y, 0);
  const right = left + requestedWidth;
  const top = bottom + requestedHeight;
  const localPoints = [
    parentTransform.toLocal({ x: left, y: bottom }),
    parentTransform.toLocal({ x: right, y: bottom }),
    parentTransform.toLocal({ x: right, y: top }),
    parentTransform.toLocal({ x: left, y: top })
  ];
  const xs = localPoints.map(point => point.x);
  const ys = localPoints.map(point => point.y);
  return {
    width: Math.max(0.05, Math.max(...xs) - Math.min(...xs)),
    height: Math.max(0.05, Math.max(...ys) - Math.min(...ys))
  };
}

function setLegacyXmlCellNumber(shape: any, name: string, value: number, groupName: string): void {
  const formatted = formatNumber(value);
  const cells = toArray(shape?.Cell);
  const cell = cells.find((candidate: any) => candidate?.N === name);
  if (cell) {
    cell.V = formatted;
    delete cell.F;
    shape.Cell = cells;
    return;
  }

  const group = ensureLegacyXmlObject(shape, groupName);
  setLegacyXmlScalar(group, name, formatted);
}

function ensureLegacyXmlObject(target: any, key: string): any {
  if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
    target[key] = {};
  }
  return target[key];
}

function setLegacyXmlScalar(target: any, key: string, value: string): void {
  const previous = target[key];
  if (previous && typeof previous === 'object' && !Array.isArray(previous)) {
    previous['#text'] = value;
    delete previous.F;
    delete previous.V;
    return;
  }
  target[key] = value;
}

function rewriteLegacyXmlConnectorGeometry(shape: any, begin: Point, end: Point): void {
  const minSize = 0.0001;
  const rawWidth = Math.abs(end.x - begin.x);
  const rawHeight = Math.abs(end.y - begin.y);
  const width = Math.max(minSize, rawWidth);
  const height = Math.max(minSize, rawHeight);
  const left = rawWidth < minSize ? begin.x - width / 2 : Math.min(begin.x, end.x);
  const bottom = rawHeight < minSize ? begin.y - height / 2 : Math.min(begin.y, end.y);
  shape.Geom = {
    IX: '0',
    MoveTo: {
      IX: '1',
      X: formatNumber(begin.x - left),
      Y: formatNumber(begin.y - bottom)
    },
    LineTo: {
      IX: '2',
      X: formatNumber(end.x - left),
      Y: formatNumber(end.y - bottom)
    }
  };
  setLegacyXmlCellNumber(shape, 'PinX', left + width / 2, 'XForm');
  setLegacyXmlCellNumber(shape, 'PinY', bottom + height / 2, 'XForm');
  setLegacyXmlCellNumber(shape, 'Width', width, 'XForm');
  setLegacyXmlCellNumber(shape, 'Height', height, 'XForm');
  setLegacyXmlCellNumber(shape, 'LocPinX', width / 2, 'XForm');
  setLegacyXmlCellNumber(shape, 'LocPinY', height / 2, 'XForm');
}

function syncConnectorGeometry(shape: any, cells: any[], begin: Point, end: Point): void {
  const minSize = 0.0001;
  const rawWidth = Math.abs(end.x - begin.x);
  const rawHeight = Math.abs(end.y - begin.y);
  const width = Math.max(minSize, rawWidth);
  const height = Math.max(minSize, rawHeight);
  const left = rawWidth < minSize ? begin.x - width / 2 : Math.min(begin.x, end.x);
  const bottom = rawHeight < minSize ? begin.y - height / 2 : Math.min(begin.y, end.y);
  const localBegin = { x: begin.x - left, y: begin.y - bottom };
  const localEnd = { x: end.x - left, y: end.y - bottom };

  setCellNumber(cells, 'PinX', left + width / 2);
  setCellNumber(cells, 'PinY', bottom + height / 2);
  setCellNumber(cells, 'Width', width);
  setCellNumber(cells, 'Height', height);
  setCellNumber(cells, 'LocPinX', width / 2);
  setCellNumber(cells, 'LocPinY', height / 2);
  rewriteConnectorGeometrySection(shape, localBegin, localEnd);
}

function rewriteConnectorGeometrySection(shape: any, localBegin: Point, localEnd: Point): void {
  const sections = ensureArrayProperty(shape, 'Section');
  const retainedSections = sections.filter((section: any) => String(section?.N ?? '').toLowerCase() !== 'geometry');
  retainedSections.push({
    N: 'Geometry',
    IX: '0',
    Row: [
      {
        T: 'MoveTo',
        IX: '1',
        Cell: [
          { N: 'X', V: formatNumber(localBegin.x) },
          { N: 'Y', V: formatNumber(localBegin.y) }
        ]
      },
      {
        T: 'LineTo',
        IX: '2',
        Cell: [
          { N: 'X', V: formatNumber(localEnd.x) },
          { N: 'Y', V: formatNumber(localEnd.y) }
        ]
      }
    ]
  });
  shape.Section = retainedSections;
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

async function readMasterShapes(zip: JSZip): Promise<Map<string, MasterShapeEntry>> {
  const masterShapes = new Map<string, MasterShapeEntry>();
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
    if (!id || !entry) {
      return undefined;
    }

    const masterFile = zip.file(entry);
    if (!masterFile) {
      return undefined;
    }

    const parsed = xmlParser.parse(await masterFile.async('text'));
    const contents = parsed.MasterContents ?? parsed['MasterContents'];
    const shapes = toArray(contents?.Shapes?.Shape);
    const shape = shapes[0];
    const imageDataUriByRelId = await readRelationshipImageDataUris(zip, entry);
    return shape
      ? {
        id,
        entry: {
          shape: {
            ...shape,
            Name: master?.Name ?? shape?.Name,
            NameU: master?.NameU ?? shape?.NameU
          },
          shapes: shapes.map((candidate, index) => index === 0
            ? {
              ...candidate,
              Name: master?.Name ?? candidate?.Name,
              NameU: master?.NameU ?? candidate?.NameU
            }
            : candidate),
          imageDataUriByRelId
        }
      }
      : undefined;
  }));

  for (const entry of masterEntries) {
    if (entry) {
      masterShapes.set(entry.id, entry.entry);
    }
  }

  return masterShapes;
}

async function readPageImageDataUris(zip: JSZip, pageEntry: string): Promise<Map<string, string>> {
  return readRelationshipImageDataUris(zip, pageEntry);
}

async function readStyleSheets(zip: JSZip): Promise<StyleSheetContext> {
  const documentFile = zip.file('visio/document.xml');
  if (!documentFile) {
    return emptyStyleSheets();
  }

  const parsed = xmlParser.parse(await documentFile.async('text'));
  const document = parsed.VisioDocument ?? parsed['VisioDocument'];
  return readStyleSheetsFromDocument(document);
}

function readStyleSheetsFromDocument(document: any): StyleSheetContext {
  const byId = new Map<string, StyleSheetEntry>();
  for (const styleSheet of toArray(document?.StyleSheets?.StyleSheet)) {
    const id = normalizedId(styleSheet?.ID);
    if (!id) {
      continue;
    }

    byId.set(id, {
      id,
      lineStyleId: normalizedId(styleSheet?.LineStyle),
      fillStyleId: normalizedId(styleSheet?.FillStyle),
      textStyleId: normalizedId(styleSheet?.TextStyle),
      cells: mergeCells(toArray(styleSheet?.Cell), collectLegacyXmlCells(styleSheet, legacyXmlCellNames)),
      sections: toArray(styleSheet?.Section)
    });
  }

  return { byId, resolvedCellCache: new Map(), resolvedSectionCache: new Map() };
}

function emptyStyleSheets(): StyleSheetContext {
  return { byId: new Map(), resolvedCellCache: new Map(), resolvedSectionCache: new Map() };
}

async function readRelationshipImageDataUris(zip: JSZip, sourceEntry: string): Promise<Map<string, string>> {
  const images = new Map<string, string>();
  const relsFile = zip.file(relationshipEntry(sourceEntry));
  if (!relsFile) {
    return images;
  }

  const parsed = xmlParser.parse(await relsFile.async('text'));
  for (const rel of toArray(parsed.Relationships?.Relationship)) {
    if (typeof rel?.Id !== 'string' || typeof rel?.Target !== 'string') {
      continue;
    }

    const target = normalizePackageTarget(sourceEntry, rel.Target);
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

function relationshipEntry(sourceEntry: string): string {
  return `${path.posix.dirname(sourceEntry)}/_rels/${path.posix.basename(sourceEntry)}.rels`;
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

function readCellNumber(cells: unknown[], name: string, refs?: Map<string, number>, seen = new Set<string>()): number | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === name) as any;
  const formulaRefs = refs ? new Map(refs) : new Map<string, number>();
  const key = name.toLowerCase();
  if (!formulaRefs.has(key) && !seen.has(key)) {
    seen.add(key);
    addFormulaRefsForCells(cells, formulaRefs, seen);
  }
  const formulaValue = readFormulaNumber(cell?.F, formulaRefs);
  if (formulaValue !== undefined) {
    return formulaValue;
  }
  const value = Number(cell?.V);
  return Number.isFinite(value) ? value : undefined;
}

function readFormulaNumber(formula: unknown, refs?: Map<string, number>): number | undefined {
  const formulaRefs = refs ? new Map(refs) : new Map<string, number>();
  return evaluateFormula(formula, {
    targetWidth: formulaRefs.get('width') ?? formulaRefs.get('thepage.pagewidth') ?? 1,
    targetHeight: formulaRefs.get('height') ?? formulaRefs.get('thepage.pageheight') ?? 1,
    sourceWidth: formulaRefs.get('width') ?? 1,
    sourceHeight: formulaRefs.get('height') ?? 1,
    scaleX: 1,
    scaleY: 1,
    scaleAverage: 1,
    refs: formulaRefs
  });
}

function readCellString(cells: unknown[], name: string): string | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === name) as any;
  return typeof cell?.V === 'string' && cell.V.trim().length > 0 ? cell.V : undefined;
}

function readTextBox(cells: unknown[], refs: Map<string, number>): VsdxEditorTextBox | undefined {
  const shapeWidth = readCellNumber(cells, 'Width', refs);
  const shapeHeight = readCellNumber(cells, 'Height', refs);
  if (shapeWidth === undefined || shapeHeight === undefined) {
    return undefined;
  }

  const width = readCellNumber(cells, 'TxtWidth', refs) ?? shapeWidth;
  const height = readCellNumber(cells, 'TxtHeight', refs) ?? shapeHeight;
  const pinX = readCellNumber(cells, 'TxtPinX', refs) ?? shapeWidth / 2;
  const pinY = readCellNumber(cells, 'TxtPinY', refs) ?? shapeHeight / 2;
  const locPinX = readCellNumber(cells, 'TxtLocPinX', refs) ?? width / 2;
  const locPinY = readCellNumber(cells, 'TxtLocPinY', refs) ?? height / 2;
  const angle = readCellNumber(cells, 'TxtAngle', refs) ?? 0;
  if (width <= 0 || height <= 0) {
    return undefined;
  }

  const textBox = {
    x: pinX - locPinX,
    y: pinY - locPinY,
    width,
    height,
    angle
  };
  const isDefault = nearlyEqual(textBox.x, 0)
    && nearlyEqual(textBox.y, 0)
    && nearlyEqual(textBox.width, shapeWidth)
    && nearlyEqual(textBox.height, shapeHeight)
    && nearlyEqual(angle, 0);
  return isDefault ? undefined : textBox;
}

function readTextStyle(cells: unknown[], sections: any[], refs: Map<string, number>): VsdxEditorTextStyle | undefined {
  const characterCells = readPrimaryCharacterCells(sections);
  const paragraphCells = readPrimaryParagraphCells(sections);
  const color = readColorCell(characterCells, 'Color')
    ?? readColorCell(cells, 'Char.Color')
    ?? readColorCell(cells, 'Color');
  const fontSize = readFontSizeCell(characterCells, refs)
    ?? readFontSizeCell(cells, refs);
  const fontStyle = readCharacterStyleCell(characterCells, refs)
    ?? readCharacterStyleCell(cells, refs);
  const horizontalAlign = readHorizontalAlign(paragraphCells, refs)
    ?? readHorizontalAlign(cells, refs);
  const verticalAlign = readVerticalAlign(cells, refs);
  const margins = readTextMargins(cells, refs);
  const background = readColorCell(cells, 'TextBkgnd');
  const backgroundOpacity = readOpacityCell(cells, 'TextBkgndTrans', refs);
  const style: VsdxEditorTextStyle = {};
  if (color) {
    style.color = color;
  }
  if (fontSize !== undefined) {
    style.fontSize = fontSize;
  }
  if (fontStyle !== undefined) {
    style.bold = (fontStyle & 1) !== 0;
    style.italic = (fontStyle & 2) !== 0;
    style.underline = (fontStyle & 4) !== 0;
  }
  if (horizontalAlign) {
    style.horizontalAlign = horizontalAlign;
  }
  if (verticalAlign) {
    style.verticalAlign = verticalAlign;
  }
  if (margins) {
    style.margins = margins;
  }
  if (background) {
    style.background = background;
  }
  if (backgroundOpacity !== undefined) {
    style.backgroundOpacity = backgroundOpacity;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

function readCharacterStyleCell(cells: unknown[], refs?: Map<string, number>): number | undefined {
  const value = readCellNumber(cells, 'Style', refs);
  if (value === undefined) {
    return undefined;
  }
  return Math.max(0, Math.trunc(value));
}

function readHorizontalAlign(cells: unknown[], refs?: Map<string, number>): VsdxEditorTextStyle['horizontalAlign'] | undefined {
  const value = readCellNumber(cells, 'HAlign', refs) ?? readCellNumber(cells, 'HorzAlign', refs);
  if (value === undefined) {
    return undefined;
  }
  const align = Math.trunc(value);
  if (align === 2) {
    return 'right';
  }
  if (align === 1 || align === 4) {
    return 'center';
  }
  return 'left';
}

function readVerticalAlign(cells: unknown[], refs?: Map<string, number>): VsdxEditorTextStyle['verticalAlign'] | undefined {
  const value = readCellNumber(cells, 'VerticalAlign', refs);
  if (value === undefined) {
    return undefined;
  }
  const align = Math.trunc(value);
  if (align === 0) {
    return 'top';
  }
  if (align === 2) {
    return 'bottom';
  }
  return 'middle';
}

function readTextMargins(cells: unknown[], refs?: Map<string, number>): VsdxEditorTextMargins | undefined {
  const margins: VsdxEditorTextMargins = {};
  const left = readTextMarginCell(cells, 'LeftMargin', refs);
  const right = readTextMarginCell(cells, 'RightMargin', refs);
  const top = readTextMarginCell(cells, 'TopMargin', refs);
  const bottom = readTextMarginCell(cells, 'BottomMargin', refs);
  if (left !== undefined) {
    margins.left = left;
  }
  if (right !== undefined) {
    margins.right = right;
  }
  if (top !== undefined) {
    margins.top = top;
  }
  if (bottom !== undefined) {
    margins.bottom = bottom;
  }
  return Object.keys(margins).length > 0 ? margins : undefined;
}

function readTextMarginCell(cells: unknown[], name: string, refs?: Map<string, number>): number | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === name) as any;
  const value = readCellNumber(cells, name, refs) ?? readUnitNumber(cell?.V) ?? readUnitNumber(cell?.F);
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, value);
}

function readPrimaryCharacterCells(sections: any[]): any[] {
  for (const section of sections.filter(section => String(section?.N ?? '').toLowerCase() === 'character')) {
    const sectionCells = toArray(section?.Cell);
    if (sectionCells.length > 0) {
      return sectionCells;
    }
    const row = toArray(section?.Row)
      .filter(candidate => String(candidate?.Del ?? '') !== '1')
      .sort((a, b) => cleanNumber(a?.IX, 0) - cleanNumber(b?.IX, 0))[0];
    const rowCells = toArray(row?.Cell);
    if (rowCells.length > 0) {
      return rowCells;
    }
  }
  return [];
}

function readPrimaryParagraphCells(sections: any[]): any[] {
  for (const section of sections.filter(section => String(section?.N ?? '').toLowerCase() === 'paragraph')) {
    const sectionCells = toArray(section?.Cell);
    if (sectionCells.length > 0) {
      return sectionCells;
    }
    const row = toArray(section?.Row)
      .filter(candidate => String(candidate?.Del ?? '') !== '1')
      .sort((a, b) => cleanNumber(a?.IX, 0) - cleanNumber(b?.IX, 0))[0];
    const rowCells = toArray(row?.Cell);
    if (rowCells.length > 0) {
      return rowCells;
    }
  }
  return [];
}

function createShapeFormulaRefs(cells: unknown[], baseRefs?: Map<string, number>): Map<string, number> {
  const refs = baseRefs ? new Map(baseRefs) : new Map<string, number>();
  addFormulaRefsForCells(cells, refs);
  return refs;
}

function addFormulaRefsForCells(cells: unknown[], refs: Map<string, number>, seen = new Set<string>()): void {
  for (const cell of cells as any[]) {
    if (typeof cell?.N !== 'string') {
      continue;
    }
    const key = cell.N.toLowerCase();
    if (refs.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const value = readCellNumber(cells, cell.N, refs, seen);
    if (value !== undefined) {
      refs.set(key, value);
    }
  }
}

function createPageFormulaRefs(pageWidth: number, pageHeight: number): Map<string, number> {
  const refs = new Map<string, number>();
  refs.set('pagewidth', pageWidth);
  refs.set('pageheight', pageHeight);
  refs.set('thepage.pagewidth', pageWidth);
  refs.set('thepage.pageheight', pageHeight);
  return refs;
}

function readFillColor(cells: unknown[]): string {
  const fillPattern = readCellNumber(cells, 'FillPattern');
  if (fillPattern === 0) {
    return 'none';
  }
  return readColorCell(cells, 'FillForegnd')
    ?? '#ffffff';
}

function readFillBackgroundColor(cells: unknown[]): string | undefined {
  const fillPattern = readCellNumber(cells, 'FillPattern');
  if (fillPattern === undefined || fillPattern <= 1) {
    return undefined;
  }
  return readColorCell(cells, 'FillBkgnd');
}

function readLineColor(cells: unknown[]): string {
  const linePattern = readCellNumber(cells, 'LinePattern');
  if (linePattern === 0) {
    return 'none';
  }
  return readColorCell(cells, 'LineColor')
    ?? '#586069';
}

function readRoundingCell(cells: unknown[], refs?: Map<string, number>): number | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === 'Rounding') as any;
  const value = readCellNumber(cells, 'Rounding', refs) ?? readUnitNumber(cell?.V) ?? readUnitNumber(cell?.F);
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, value);
}

function readShadowStyle(cells: unknown[], refs?: Map<string, number>): VsdxEditorShadow | undefined {
  const show = readCellNumber(cells, 'ShapeShdwShow', refs);
  if (show === 0) {
    return undefined;
  }
  const pattern = readCellNumber(cells, 'ShdwPattern', refs);
  if (pattern === 0) {
    return undefined;
  }

  const color = readColorCell(cells, 'ShdwForegnd') ?? '#000000';
  const opacity = readOpacityCell(cells, 'ShdwForegndTrans', refs) ?? 0.28;
  const offsetX = readShadowOffsetCell(cells, 'ShapeShdwOffsetX', refs);
  const offsetY = readShadowOffsetCell(cells, 'ShapeShdwOffsetY', refs);
  const scale = readShadowScaleCell(cells, refs);
  const hasEvidence = pattern !== undefined
    || show !== undefined
    || offsetX !== undefined
    || offsetY !== undefined
    || scale !== undefined
    || readColorCell(cells, 'ShdwForegnd') !== undefined
    || readOpacityCell(cells, 'ShdwForegndTrans', refs) !== undefined;

  if (!hasEvidence || opacity <= 0) {
    return undefined;
  }

  return {
    color,
    opacity: Math.max(0, Math.min(1, opacity)),
    offsetX: offsetX ?? 0.06,
    offsetY: offsetY ?? -0.06,
    scale
  };
}

function readShadowOffsetCell(cells: unknown[], name: string, refs?: Map<string, number>): number | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === name) as any;
  return readCellNumber(cells, name, refs) ?? readUnitNumber(cell?.V) ?? readUnitNumber(cell?.F);
}

function readShadowScaleCell(cells: unknown[], refs?: Map<string, number>): number | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === 'ShapeShdwScaleFactor') as any;
  const value = readCellNumber(cells, 'ShapeShdwScaleFactor', refs) ?? readUnitNumber(cell?.V) ?? readUnitNumber(cell?.F);
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value > 10 ? value / 100 : value;
}

function readOpacityCell(cells: unknown[], name: string, refs?: Map<string, number>): number | undefined {
  const transparency = readCellNumber(cells, name, refs);
  if (transparency === undefined) {
    return undefined;
  }
  return Math.max(0, Math.min(1, 1 - Math.max(0, Math.min(100, transparency)) / 100));
}

function readFontSizeCell(cells: unknown[], refs?: Map<string, number>): number | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === 'Size') as any;
  if (!cell) {
    return undefined;
  }
  const numeric = readCellNumber(cells, 'Size', refs) ?? readUnitNumber(cell.V) ?? readUnitNumber(cell.F);
  if (numeric === undefined) {
    return undefined;
  }
  return normalizeFontSize(numeric, inferUnit(cell));
}

function readUnitNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const match = value.trim().match(/(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/);
  if (!match) {
    return undefined;
  }
  const number = Number(match[1]);
  return Number.isFinite(number) ? number : undefined;
}

function inferUnit(cell: any): string | undefined {
  const explicit = typeof cell?.U === 'string' ? cell.U.trim().toLowerCase() : '';
  if (explicit) {
    return explicit;
  }
  for (const value of [cell?.V, cell?.F]) {
    if (typeof value !== 'string') {
      continue;
    }
    const match = value.match(/(?:\d+\.?\d*|\.\d+)\s*(pt|in|dl|mm|cm)\b/i);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  return undefined;
}

function normalizeFontSize(value: number, unit?: string): number | undefined {
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  switch ((unit ?? '').toLowerCase()) {
    case 'pt':
      return value / 72;
    case 'mm':
      return value / 25.4;
    case 'cm':
      return value / 2.54;
    case 'in':
    case 'dl':
      return value;
    default:
      return value > 2 ? value / 72 : value;
  }
}

function readColorCell(cells: unknown[], name: string): string | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === name) as any;
  if (!cell) {
    return undefined;
  }
  return normalizeColor(cell.F) ?? normalizeColor(cell.V);
}

function normalizeColor(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return visioIndexedColor(value);
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return visioIndexedColor(Number(trimmed));
  }
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

function visioIndexedColor(index: number): string | undefined {
  switch (index) {
    case 0:
      return '#000000';
    case 1:
      return '#ffffff';
    case 2:
      return '#ff0000';
    case 3:
      return '#00ff00';
    case 4:
      return '#0000ff';
    case 5:
      return '#ffff00';
    case 6:
      return '#ff00ff';
    case 7:
      return '#00ffff';
    default:
      return undefined;
  }
}

function toHexByte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

function readCellFormula(cells: unknown[], name: string): string | undefined {
  const cell = cells.find((candidate: any) => candidate?.N === name) as any;
  return typeof cell?.F === 'string' && cell.F.trim().length > 0 ? cell.F : undefined;
}

function styleCellsForShape(shape: any, styleSheets: StyleSheetContext): any[] {
  if (!shape) {
    return [];
  }

  return mergeEffectiveCellLayers(
    styleCellsForCategory(normalizedId(shape?.LineStyle), 'line', styleSheets),
    styleCellsForCategory(normalizedId(shape?.FillStyle), 'fill', styleSheets),
    styleCellsForCategory(normalizedId(shape?.TextStyle), 'text', styleSheets)
  );
}

function styleSectionsForShape(shape: any, styleSheets: StyleSheetContext): any[] {
  if (!shape) {
    return [];
  }

  return mergeEffectiveSections(
    styleSectionsForCategory(normalizedId(shape?.LineStyle), 'line', styleSheets),
    styleSectionsForCategory(normalizedId(shape?.FillStyle), 'fill', styleSheets),
    styleSectionsForCategory(normalizedId(shape?.TextStyle), 'text', styleSheets)
  );
}

function styleCellsForCategory(
  styleId: string | undefined,
  category: StyleCategory,
  styleSheets: StyleSheetContext,
  seen = new Set<string>()
): any[] {
  if (!styleId || seen.has(`${category}:${styleId}`)) {
    return [];
  }
  const cacheKey = `${category}:${styleId}`;
  const cached = styleSheets.resolvedCellCache.get(cacheKey);
  if (cached) {
    return cached.map(cell => cloneXml(cell));
  }

  const styleSheet = styleSheets.byId.get(styleId);
  if (!styleSheet) {
    return [];
  }

  seen.add(cacheKey);
  const parentStyleId = category === 'line'
    ? styleSheet.lineStyleId
    : category === 'fill'
      ? styleSheet.fillStyleId
      : styleSheet.textStyleId;

  const baseCells = styleId === '0' ? [] : styleCellsForCategory('0', category, styleSheets, seen);
  const parentCells = parentStyleId === '0' ? [] : styleCellsForCategory(parentStyleId, category, styleSheets, seen);
  const resolved = mergeEffectiveCellLayers(
    baseCells,
    parentCells,
    styleSheet.cells.filter(cell => isStyleCellForCategory(cell, category) && isMeaningfulStyleCell(cell))
  );
  styleSheets.resolvedCellCache.set(cacheKey, resolved.map(cell => cloneXml(cell)));
  return resolved;
}

function styleSectionsForCategory(
  styleId: string | undefined,
  category: StyleCategory,
  styleSheets: StyleSheetContext,
  seen = new Set<string>()
): any[] {
  if (!styleId || seen.has(`${category}:${styleId}`)) {
    return [];
  }
  const cacheKey = `${category}:${styleId}`;
  const cached = styleSheets.resolvedSectionCache.get(cacheKey);
  if (cached) {
    return cached.map(section => cloneXml(section));
  }

  const styleSheet = styleSheets.byId.get(styleId);
  if (!styleSheet) {
    return [];
  }

  seen.add(cacheKey);
  const parentStyleId = category === 'line'
    ? styleSheet.lineStyleId
    : category === 'fill'
      ? styleSheet.fillStyleId
      : styleSheet.textStyleId;

  const baseSections = styleId === '0' ? [] : styleSectionsForCategory('0', category, styleSheets, seen);
  const parentSections = parentStyleId === '0' ? [] : styleSectionsForCategory(parentStyleId, category, styleSheets, seen);
  const localSections = category === 'text'
    ? styleSheet.sections.filter(isTextStyleSection)
    : [];
  const resolved = mergeEffectiveSections(baseSections, parentSections, localSections);
  styleSheets.resolvedSectionCache.set(cacheKey, resolved.map(section => cloneXml(section)));
  return resolved;
}

function isTextStyleSection(section: any): boolean {
  const name = String(section?.N ?? '').toLowerCase();
  return name === 'character' || name === 'paragraph';
}

function mergeEffectiveCellLayers(...layers: any[][]): any[] {
  return layers.reduce((merged, layer) => mergeEffectiveCells(merged, layer), [] as any[]);
}

function mergeEffectiveSections(...layers: any[][]): any[] {
  return layers.reduce((merged, layer) => mergeShapeSections(merged, layer), [] as any[]);
}

function mergeEffectiveCells(baseCells: any[], overrideCells: any[]): any[] {
  const merged = new Map<string, any>();
  const order: string[] = [];
  for (const cell of baseCells) {
    const key = cellKey(cell, order.length);
    merged.set(key, cloneXml(cell));
    order.push(key);
  }

  for (const cell of overrideCells) {
    const key = cellKey(cell, order.length);
    if (!isMeaningfulEffectiveCell(cell)) {
      continue;
    }
    if (!merged.has(key)) {
      order.push(key);
    }
    merged.set(key, {
      ...cloneXml(merged.get(key) ?? {}),
      ...cloneXml(cell)
    });
  }

  return order.map(key => merged.get(key)).filter(isDefined);
}

function isMeaningfulStyleCell(cell: any): boolean {
  const formula = String(cell?.F ?? '').trim().toLowerCase();
  if (formula === 'inh' || formula === 'no formula') {
    return false;
  }
  return isMeaningfulEffectiveCell(cell);
}

function isStyleCellForCategory(cell: any, category: StyleCategory): boolean {
  const name = String(cell?.N ?? '');
  if (!name) {
    return false;
  }
  if (category === 'line') {
    return lineStyleCellNames.has(name);
  }
  if (category === 'fill') {
    return fillStyleCellNames.has(name);
  }
  return textStyleCellNames.has(name);
}

function isMeaningfulEffectiveCell(cell: any): boolean {
  const formula = String(cell?.F ?? '').trim().toLowerCase();
  if (String(cell?.V ?? '').trim().toLowerCase() === 'themed' && formula.length === 0) {
    return false;
  }
  if (String(cell?.V ?? '').trim().toLowerCase() === 'themed' && (formula === 'inh' || formula === 'no formula')) {
    return false;
  }
  return true;
}

function readMasterShapeFor(shape: any, masterShapes: Map<string, MasterShapeEntry>): any | undefined {
  return readMasterEntryFor(shape, masterShapes)?.shape;
}

function inheritedMasterPreviewShapes(masterEntry: MasterShapeEntry): any[] {
  return [
    ...toArray(masterEntry.shape?.Shapes?.Shape),
    ...masterEntry.shapes.slice(1)
  ];
}

function readMasterImageDataUriByRelIdFor(shape: any, masterShapes: Map<string, MasterShapeEntry>): Map<string, string> {
  return readMasterEntryFor(shape, masterShapes)?.imageDataUriByRelId ?? new Map();
}

function readMasterEntryFor(shape: any, masterShapes: Map<string, MasterShapeEntry>): MasterShapeEntry | undefined {
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

    const inlineImage = readInlineForeignImageDataUri(foreignData);
    if (inlineImage) {
      return inlineImage;
    }
  }
  return undefined;
}

function readInlineForeignImageDataUri(foreignData: any): string | undefined {
  const directDataUri = readDataUriPayload(foreignData);
  if (directDataUri) {
    return directDataUri;
  }

  const base64 = readForeignDataBase64Payload(foreignData);
  if (!base64) {
    return undefined;
  }

  const mimeType = mimeTypeForForeignData(foreignData) ?? inferMimeTypeFromBase64(base64);
  return mimeType ? `data:${mimeType};base64,${base64}` : undefined;
}

function readDataUriPayload(value: unknown): string | undefined {
  const text = readTextPayload(value);
  if (!text) {
    return undefined;
  }

  const match = text.trim().match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    return undefined;
  }

  const base64 = normalizeBase64(match[2]);
  return base64 ? `data:${match[1].toLowerCase()};base64,${base64}` : undefined;
}

function readForeignDataBase64Payload(foreignData: any): string | undefined {
  for (const candidate of [
    foreignData?.Data,
    foreignData?.ImageData,
    foreignData?.Bitmap,
    foreignData?.Value,
    foreignData?.V,
    foreignData?.['#text']
  ]) {
    const base64 = normalizeBase64(readTextPayload(candidate));
    if (base64) {
      return base64;
    }
  }
  return undefined;
}

function readTextPayload(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = readTextPayload(item);
      if (text) {
        return text;
      }
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['#text', 'Data', 'ImageData', 'Value', 'V']) {
      const text = readTextPayload(record[key]);
      if (text) {
        return text;
      }
    }
  }
  return undefined;
}

function normalizeBase64(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const compact = value.replace(/\s+/g, '');
  if (compact.length < 12 || !/^[a-z0-9+/]+={0,2}$/i.test(compact)) {
    return undefined;
  }
  return compact;
}

function mimeTypeForForeignData(foreignData: any): string | undefined {
  const compression = String(foreignData?.CompressionType ?? foreignData?.Compression ?? '').toLowerCase();
  if (compression.includes('png')) {
    return 'image/png';
  }
  if (compression.includes('jpg') || compression.includes('jpeg')) {
    return 'image/jpeg';
  }
  if (compression.includes('gif')) {
    return 'image/gif';
  }
  if (compression.includes('bmp') || compression.includes('dib')) {
    return 'image/bmp';
  }
  if (compression.includes('webp')) {
    return 'image/webp';
  }
  if (compression.includes('svg')) {
    return 'image/svg+xml';
  }
  return undefined;
}

function inferMimeTypeFromBase64(base64: string): string | undefined {
  if (base64.startsWith('iVBORw0KGgo')) {
    return 'image/png';
  }
  if (base64.startsWith('/9j/')) {
    return 'image/jpeg';
  }
  if (base64.startsWith('R0lGOD')) {
    return 'image/gif';
  }
  if (base64.startsWith('Qk')) {
    return 'image/bmp';
  }
  if (base64.startsWith('PHN2Zy') || base64.startsWith('PD94bW')) {
    return 'image/svg+xml';
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
    .replace(/!/g, '.')
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
    delete cell.F;
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
  const formulaRefs = createShapeFormulaRefs(cells);
  transformCellPointPair(transformedCells, parentTransform, 'PinX', 'PinY', formulaRefs);
  transformCellPointPair(transformedCells, parentTransform, 'BeginX', 'BeginY', formulaRefs);
  transformCellPointPair(transformedCells, parentTransform, 'EndX', 'EndY', formulaRefs);

  const pageShape = {
    ...shape,
    Cell: transformedCells
  };

  if (!isConnectorShape(pageShape)) {
    normalizeShapeBounds(cells, transformedCells, localToPageTransform);
  }

  return pageShape;
}

function transformCellPointPair(
  cells: any[],
  transform: PointTransform,
  xName: string,
  yName: string,
  formulaRefs?: Map<string, number>
): void {
  const x = readCellNumber(cells, xName, formulaRefs);
  const y = readCellNumber(cells, yName, formulaRefs);
  if (x === undefined || y === undefined) {
    return;
  }

  const point = transform.toPage({ x, y });
  setCellNumber(cells, xName, point.x);
  setCellNumber(cells, yName, point.y);
}

function createLocalToPageTransform(shape: any, parentTransform?: PointTransform): PointTransform | undefined {
  const cells = shapeTransformCells(shape);
  const formulaRefs = createShapeFormulaRefs(cells);
  const pinX = readCellNumber(cells, 'PinX', formulaRefs);
  const pinY = readCellNumber(cells, 'PinY', formulaRefs);
  const locPinX = readLocPin(cells, 'LocPinX', 'Width', formulaRefs);
  const locPinY = readLocPin(cells, 'LocPinY', 'Height', formulaRefs);
  if ([pinX, pinY, locPinX, locPinY].some(value => value === undefined)) {
    return parentTransform;
  }

  const angle = readCellNumber(cells, 'Angle', formulaRefs) ?? 0;
  const flipX = readCellNumber(cells, 'FlipX', formulaRefs) === 1;
  const flipY = readCellNumber(cells, 'FlipY', formulaRefs) === 1;
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
    },
    toLocal(point: Point): Point {
      const parentPoint = parentTransform ? parentTransform.toLocal(point) : point;
      const deltaX = parentPoint.x - pinX!;
      const deltaY = parentPoint.y - pinY!;
      const rotatedX = deltaX * cos + deltaY * sin;
      const rotatedY = -deltaX * sin + deltaY * cos;
      return {
        x: locPinX! + (flipX ? -rotatedX : rotatedX),
        y: locPinY! + (flipY ? -rotatedY : rotatedY)
      };
    }
  };
}

function shapeTransformCells(shape: any): any[] {
  return mergeCells(
    toArray(shape?.Cell),
    collectLegacyXmlCells(shape, legacyXmlCellNames)
  );
}

function transformedLocalBounds(
  width: number,
  height: number,
  transform: PointTransform | undefined
): { width: number; height: number } | undefined {
  if (!transform) {
    return undefined;
  }

  const points = [
    transform.toPage({ x: 0, y: 0 }),
    transform.toPage({ x: width, y: 0 }),
    transform.toPage({ x: width, y: height }),
    transform.toPage({ x: 0, y: height })
  ];
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
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
    },
    toLocal(point: Point): Point {
      const localPoint = instanceTransform.toLocal(point);
      return {
        x: localPoint.x * (masterWidth / instanceWidth),
        y: localPoint.y * (masterHeight / instanceHeight)
      };
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

function readLocPin(cells: unknown[], locPinName: string, sizeName: string, refs?: Map<string, number>): number | undefined {
  const locPin = readCellNumber(cells, locPinName, refs);
  if (locPin !== undefined) {
    return locPin;
  }

  const size = readCellNumber(cells, sizeName, refs);
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
