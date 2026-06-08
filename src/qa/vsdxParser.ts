import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { getPreviewFreshness as getCachedPreviewFreshness } from '../cache/cacheIndex';
import { CacheIndex, QaPageStat, QaResult, QaRisk, RadarConfig } from '../types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  trimValues: true
});

export async function analyzeVsdx(
  sourcePath: string,
  previewPath: string | undefined,
  cacheIndex: CacheIndex,
  config: RadarConfig
): Promise<QaResult> {
  const risks: QaRisk[] = [];
  const sourceEvidence = await readSourceEvidence(sourcePath);
  const cacheRecord = cacheIndex.records[sourcePath];
  const previewPaths = cacheRecord?.previewPaths?.length
    ? cacheRecord.previewPaths
    : previewPath
      ? [previewPath]
      : [];
  const previewExists = previewPaths.length > 0 && previewPaths.every(candidate => existsSync(candidate));
  const freshnessPreviewPath = previewPath ?? cacheRecord?.previewPath ?? previewPaths[0];
  const previewFreshness = previewPaths.length > 0 && freshnessPreviewPath
    ? await getCachedPreviewFreshness(cacheIndex, sourcePath, freshnessPreviewPath, cacheRecord?.format ?? config.previewFormat)
    : { fresh: false, reasons: [] };
  const previewFresh = previewFreshness.fresh;
  const previewFreshnessReasons = previewFreshness.reasons;

  if (!previewExists) {
    risks.push({
      severity: 'error',
      code: 'PREVIEW_MISSING',
      message: 'Preview file is missing.'
    });
  } else if (!previewFresh) {
    const reasonText = previewFreshnessReasons.length > 0
      ? ` Reasons: ${previewFreshnessReasons.join('; ')}.`
      : '';
    risks.push({
      severity: 'warning',
      code: 'PREVIEW_STALE',
      message: `Preview exists but does not match the cache record for the current source file.${reasonText}`
    });
  }

  let pages: QaPageStat[] = [];
  try {
    pages = await readPageStats(sourcePath, config, risks);
  } catch (error) {
    risks.push({
      severity: 'error',
      code: 'VSDX_PARSE_FAILED',
      message: error instanceof Error ? error.message : String(error)
    });
  }

  if (pages.length === 0) {
    risks.push({
      severity: 'error',
      code: 'NO_PAGES',
      message: 'No Visio page XML entries were found.'
    });
  }
  const exportedPageCount = cacheRecord?.exportedPageCount ?? previewPaths.length;
  if (pages.length > 1 && exportedPageCount < pages.length) {
    risks.push({
      severity: 'warning',
      code: 'MULTIPAGE_PREVIEW_INCOMPLETE',
      message: `Only ${exportedPageCount || 1} preview(s) are recorded for ${pages.length} page(s).`
    });
  }

  return {
    schemaVersion: 1,
    sourcePath,
    ...sourceEvidence,
    generatedAt: new Date().toISOString(),
    previewPath,
    previewPaths,
    previewExists,
    previewFresh,
    previewFreshnessReasons,
    stats: {
      pageCount: pages.length,
      shapeCount: pages.reduce((sum, page) => sum + page.shapeCount, 0),
      textShapeCount: pages.reduce((sum, page) => sum + page.textShapeCount, 0),
      unlabeledShapeCount: pages.reduce((sum, page) => sum + page.unlabeledShapeCount, 0),
      oneDShapeCount: pages.reduce((sum, page) => sum + page.oneDShapeCount, 0),
      connectCount: pages.reduce((sum, page) => sum + page.connectCount, 0),
      duplicateShapeIdCount: pages.reduce((sum, page) => sum + page.duplicateShapeIdCount, 0),
      outOfBoundsShapeCount: pages.reduce((sum, page) => sum + page.outOfBoundsShapeCount, 0),
      diagonalConnectorCount: pages.reduce((sum, page) => sum + page.diagonalConnectorCount, 0),
      connectorCrossingCount: pages.reduce((sum, page) => sum + page.connectorCrossingCount, 0),
      danglingConnectorCount: pages.reduce((sum, page) => sum + page.danglingConnectorCount, 0),
      straightConnectorCount: pages.reduce((sum, page) => sum + page.straightConnectorCount, 0),
      orthogonalConnectorCount: pages.reduce((sum, page) => sum + page.orthogonalConnectorCount, 0),
      complexConnectorCount: pages.reduce((sum, page) => sum + page.complexConnectorCount, 0),
      shapeOverlapPairCount: pages.reduce((sum, page) => sum + page.shapeOverlapPairCount, 0),
      averagePageCoverageRatio: averageDefined(pages.map(page => page.pageCoverageRatio))
    },
    pages,
    risks
  };
}

async function readSourceEvidence(sourcePath: string): Promise<Pick<QaResult, 'sourceMtimeMs' | 'sourceModifiedAt'>> {
  try {
    const stat = await fs.stat(sourcePath);
    return {
      sourceMtimeMs: stat.mtimeMs,
      sourceModifiedAt: stat.mtime.toISOString()
    };
  } catch {
    return {};
  }
}

async function readPageStats(
  sourcePath: string,
  config: RadarConfig,
  risks: QaRisk[]
): Promise<QaPageStat[]> {
  const buffer = await fs.readFile(sourcePath);
  const zip = await JSZip.loadAsync(buffer);
  const pageEntries = Object.keys(zip.files)
    .filter(name => /^visio\/pages\/page\d+\.xml$/i.test(name))
    .sort(sortPageEntries);
  const pageMetaByEntry = await readPageMetadata(zip);

  const pages: QaPageStat[] = [];
  for (const entryName of pageEntries) {
    const file = zip.file(entryName);
    if (!file) {
      continue;
    }

    const xml = await file.async('text');
    const parsed = xmlParser.parse(xml);
    const pageContents = parsed.PageContents ?? parsed['PageContents'];
    const shapes = collectPageShapes(toArray(pageContents?.Shapes?.Shape));
    const connects = toArray(pageContents?.Connects?.Connect);
    const oneDShapes = shapes.filter(shape => String(shape?.OneD ?? '') === '1');
    const connectorShapes = shapes.filter(isConnectorShape);
    const pageMeta = pageMetaByEntry.get(entryName);
    const name = pageMeta?.name ?? entryName.match(/page(\d+)\.xml$/i)?.[1] ?? entryName;
    const textShapeCount = shapes.filter(hasVisibleText).length;
    const unlabeledShapeCount = shapes.filter(shape => !isConnectorShape(shape) && !hasVisibleText(shape)).length;
    const outOfBoundsShapeCount = pageMeta ? shapes.filter(shape => isShapeOutOfBounds(shape, pageMeta.width, pageMeta.height)).length : 0;
    const duplicateShapeIds = findDuplicateShapeIds(shapes);
    const duplicateShapeIdCount = duplicateShapeIds.reduce((sum, duplicate) => sum + duplicate.extraCount, 0);
    const duplicateShapeIdSet = new Set(duplicateShapeIds.map(duplicate => duplicate.id));
    const pageShapeIds = new Set(shapes.map(shape => normalizedId(shape?.ID)).filter(isDefined));
    const connectorConnections = buildConnectorConnections(connects, pageShapeIds, duplicateShapeIdSet);
    const shapeBounds = shapes.filter(shape => !isConnectorShape(shape)).map(getShapeBounds).filter(isDefined);
    const connectorSegments = connectorShapes
      .map(shape => getConnectorSegment(shape, connectorConnections.get(String(shape?.ID ?? ''))))
      .filter(isDefined);
    const diagonalConnectorCount = connectorSegments.filter(isDiagonalSegment).length;
    const connectorCrossingCount = countConnectorCrossings(connectorSegments, shapeBounds);
    const danglingConnectorCount = connectorSegments.filter(segment => segment.connectedShapeIds.size === 0).length;
    const straightConnectorCount = connectorSegments.filter(segment => segment.routeKind === 'straight').length;
    const orthogonalConnectorCount = connectorSegments.filter(segment => segment.routeKind === 'orthogonal').length;
    const complexConnectorCount = connectorSegments.filter(segment => segment.routeKind === 'complex').length;
    const shapeOverlapPairCount = countShapeOverlaps(shapeBounds);
    const pageCoverageRatio = pageMeta?.width && pageMeta?.height
      ? calculatePageCoverageRatio(shapeBounds, pageMeta.width, pageMeta.height)
      : undefined;
    const pageRisks: QaRisk[] = [];

    if (shapes.length === 0) {
      pageRisks.push({
        severity: 'error',
        code: 'PAGE_EMPTY',
        message: 'Page has no shapes.',
        page: name
      });
    }

    if (duplicateShapeIdCount > 0) {
      pageRisks.push({
        severity: 'warning',
        code: 'DUPLICATE_SHAPE_IDS',
        message: `${duplicateShapeIdCount} duplicate Shape ID occurrence(s) found: ${duplicateShapeIds.map(duplicate => duplicate.id).join(', ')}.`,
        page: name
      });
    }

    if (shapes.length > 5 && connectorShapes.length === 0 && connects.length === 0) {
      pageRisks.push({
        severity: 'warning',
        code: 'NO_CONNECTORS',
        message: 'Page has several shapes but no connector evidence.',
        page: name
      });
    }

    if (config.enableShapeDensityWarning && shapes.length > config.shapeDensityWarningThreshold) {
      pageRisks.push({
        severity: 'warning',
        code: 'SHAPE_DENSITY_HIGH',
        message: `Page has ${shapes.length} shapes, above threshold ${config.shapeDensityWarningThreshold}.`,
        page: name
      });
    }

    if (!pageMeta?.width || !pageMeta?.height) {
      pageRisks.push({
        severity: 'warning',
        code: 'PAGE_SIZE_UNKNOWN',
        message: 'Page width or height could not be read from pages.xml.',
        page: name
      });
    } else if (pageMeta.width < 1 || pageMeta.height < 1) {
      pageRisks.push({
        severity: 'error',
        code: 'PAGE_SIZE_INVALID',
        message: `Page size looks invalid: width=${pageMeta.width}, height=${pageMeta.height}.`,
        page: name
      });
    }

    if (config.enableUnlabeledShapeWarning && unlabeledShapeCount > 0) {
      pageRisks.push({
        severity: 'warning',
        code: 'UNLABELED_SHAPES',
        message: `${unlabeledShapeCount} non-connector shape(s) have no visible text.`,
        page: name
      });
    }

    if (outOfBoundsShapeCount > 0) {
      pageRisks.push({
        severity: 'error',
        code: 'SHAPE_OUT_OF_BOUNDS',
        message: `${outOfBoundsShapeCount} shape(s) extend beyond the page boundary.`,
        page: name
      });
    }

    if (config.enableConnectorRatioWarning && shapes.length >= 6 && connects.length / Math.max(1, shapes.length) < config.connectorRatioWarningThreshold) {
      pageRisks.push({
        severity: 'warning',
        code: 'CONNECTOR_RATIO_LOW',
        message: `Connector ratio is low: connects=${connects.length}, shapes=${shapes.length}, threshold=${config.connectorRatioWarningThreshold}.`,
        page: name
      });
    }

    if (config.enableDiagonalConnectorWarning && diagonalConnectorCount > 0) {
      pageRisks.push({
        severity: 'warning',
        code: 'DIAGONAL_CONNECTORS',
        message: `${diagonalConnectorCount} connector(s) are diagonal; review for routing clarity.`,
        page: name
      });
    }

    if (config.enableConnectorCrossingWarning && connectorCrossingCount > 0) {
      pageRisks.push({
        severity: 'warning',
        code: 'CONNECTOR_CROSSES_SHAPE',
        message: `${connectorCrossingCount} connector segment(s) appear to cross through a non-connector shape.`,
        page: name
      });
    }

    if (config.enableDanglingConnectorWarning && danglingConnectorCount > 0) {
      pageRisks.push({
        severity: 'warning',
        code: 'DANGLING_CONNECTORS',
        message: `${danglingConnectorCount} connector(s) have no Connects relationship evidence.`,
        page: name
      });
    }

    if (config.enableShapeOverlapWarning && shapeOverlapPairCount > 0) {
      pageRisks.push({
        severity: 'warning',
        code: 'SHAPE_OVERLAP',
        message: `${shapeOverlapPairCount} non-connector shape pair(s) overlap; review layout clarity.`,
        page: name
      });
    }

    if (config.enablePageCoverageWarning && pageCoverageRatio !== undefined && shapes.length > 0 && pageCoverageRatio < config.pageCoverageLowWarningThreshold) {
      pageRisks.push({
        severity: 'warning',
        code: 'PAGE_COVERAGE_LOW',
        message: `Page coverage is low: ${formatRatio(pageCoverageRatio)}, threshold=${formatRatio(config.pageCoverageLowWarningThreshold)}.`,
        page: name
      });
    } else if (config.enablePageCoverageWarning && pageCoverageRatio !== undefined && pageCoverageRatio > config.pageCoverageHighWarningThreshold) {
      pageRisks.push({
        severity: 'warning',
        code: 'PAGE_COVERAGE_HIGH',
        message: `Page coverage is high: ${formatRatio(pageCoverageRatio)}, threshold=${formatRatio(config.pageCoverageHighWarningThreshold)}.`,
        page: name
      });
    }

    risks.push(...pageRisks);
    pages.push({
      name,
      entry: entryName,
      width: pageMeta?.width,
      height: pageMeta?.height,
      shapeCount: shapes.length,
      textShapeCount,
      unlabeledShapeCount,
      oneDShapeCount: oneDShapes.length,
      connectCount: connects.length,
      duplicateShapeIdCount,
      outOfBoundsShapeCount,
      diagonalConnectorCount,
      connectorCrossingCount,
      danglingConnectorCount,
      straightConnectorCount,
      orthogonalConnectorCount,
      complexConnectorCount,
      shapeOverlapPairCount,
      pageCoverageRatio,
      riskCount: pageRisks.length
    });
  }

  return pages;
}

interface DuplicateShapeId {
  id: string;
  extraCount: number;
}

interface ShapeBounds {
  shapeId: string;
  left: number;
  right: number;
  bottom: number;
  top: number;
}

type ConnectorRouteKind = 'straight' | 'orthogonal' | 'complex';

interface ConnectorPoint {
  x: number;
  y: number;
}

interface PointTransform {
  toPage(point: ConnectorPoint): ConnectorPoint;
}

interface ConnectorSegment {
  shapeId: string;
  connectedShapeIds: Set<string>;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  routeKind: ConnectorRouteKind;
  routeSegmentCount: number;
  routePoints: ConnectorPoint[];
}

interface PageMetadata {
  name: string;
  entry: string;
  width?: number;
  height?: number;
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
      name: String(page?.Name ?? page?.NameU ?? entry),
      entry,
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

function buildConnectorConnections(connects: any[], pageShapeIds: Set<string>, ambiguousShapeIds: Set<string>): Map<string, Set<string>> {
  const connections = new Map<string, Set<string>>();
  for (const connect of connects) {
    const fromSheet = normalizedId(connect?.FromSheet);
    const toSheet = normalizedId(connect?.ToSheet);
    if (
      !fromSheet
      || !toSheet
      || fromSheet === toSheet
      || !pageShapeIds.has(fromSheet)
      || !pageShapeIds.has(toSheet)
      || ambiguousShapeIds.has(fromSheet)
      || ambiguousShapeIds.has(toSheet)
    ) {
      continue;
    }

    const connectedShapes = connections.get(fromSheet) ?? new Set<string>();
    connectedShapes.add(toSheet);
    connections.set(fromSheet, connectedShapes);
  }
  return connections;
}

function normalizedId(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const id = String(value).trim();
  return id.length > 0 ? id : undefined;
}

function findDuplicateShapeIds(shapes: any[]): DuplicateShapeId[] {
  const counts = new Map<string, number>();
  for (const shape of shapes) {
    const id = normalizedId(shape?.ID);
    if (!id) {
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, extraCount: count - 1 }));
}

function collectPageShapes(shapes: any[], parentTransform?: PointTransform): any[] {
  const collected: any[] = [];
  for (const shape of shapes) {
    const pageShape = parentTransform ? transformShapeCoordinates(shape, parentTransform) : shape;
    collected.push(pageShape);

    const childTransform = createLocalToPageTransform(shape, parentTransform);
    const childShapes = toArray(shape?.Shapes?.Shape);
    if (childShapes.length > 0) {
      collected.push(...collectPageShapes(childShapes, childTransform));
    }
  }
  return collected;
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

  const transformedSections = transformConnectorGeometrySections(shape, parentTransform, localToPageTransform, transformedCells);
  if (transformedSections) {
    pageShape.Section = transformedSections;
  }

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

function setCellNumber(cells: any[], name: string, value: number): void {
  const cell = cells.find((candidate: any) => candidate?.N === name);
  if (cell) {
    cell.V = String(value);
  }
}

function setExistingCellNumber(cells: any[], name: string, value: number): void {
  setCellNumber(cells, name, value);
}

function upsertCellNumber(cells: any[], name: string, value: number): void {
  const cell = cells.find((candidate: any) => candidate?.N === name);
  if (cell) {
    cell.V = String(value);
  } else {
    cells.push({ N: name, V: String(value) });
  }
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
    toPage(point: ConnectorPoint): ConnectorPoint {
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

function transformConnectorGeometrySections(
  shape: any,
  parentTransform: PointTransform,
  localToPageTransform: PointTransform | undefined,
  transformedCells: any[]
): any[] | undefined {
  const sections = toArray(shape?.Section);
  if (sections.length === 0 || !isConnectorShape({ ...shape, Cell: transformedCells })) {
    return undefined;
  }

  const geometryPoints = getConnectorGeometryPoints(shape);
  const begin = readCellPoint(transformedCells, 'BeginX', 'BeginY');
  const end = readCellPoint(transformedCells, 'EndX', 'EndY');
  if (geometryPoints.length === 0 || !begin || !end) {
    return undefined;
  }

  if (geometryRouteMatchesEndpoints(geometryPoints, begin, end)) {
    return undefined;
  }

  const localGeometryPoints = localToPageTransform
    ? geometryPoints.map(point => localToPageTransform.toPage(point))
    : undefined;
  if (localGeometryPoints && geometryRouteMatchesEndpoints(localGeometryPoints, begin, end)) {
    return rewriteGeometrySections(sections, localGeometryPoints);
  }

  const parentGeometryPoints = geometryPoints.map(point => parentTransform.toPage(point));
  if (geometryRouteMatchesEndpoints(parentGeometryPoints, begin, end)) {
    return rewriteGeometrySections(sections, parentGeometryPoints);
  }

  return undefined;
}

function readCellPoint(cells: any[], xName: string, yName: string): ConnectorPoint | undefined {
  const x = readCellNumber(cells, xName);
  const y = readCellNumber(cells, yName);
  if (x === undefined || y === undefined) {
    return undefined;
  }
  return { x, y };
}

function geometryRouteMatchesEndpoints(points: ConnectorPoint[], begin: ConnectorPoint, end: ConnectorPoint): boolean {
  if (points.length === 0) {
    return false;
  }
  return samePoint(points[0], begin) && samePoint(points[points.length - 1], end);
}

function rewriteGeometrySections(sections: any[], pagePoints: ConnectorPoint[]): any[] {
  let pointIndex = 0;
  return sections.map((section: any) => {
    if (String(section?.N ?? '').toLowerCase() !== 'geometry') {
      return { ...section };
    }

    const rows = toArray(section?.Row).map((row: any) => {
      const cells = toArray(row?.Cell).map((cell: any) => ({ ...cell }));
      if (String(row?.Del ?? '') === '1' || !cells.some((cell: any) => cell?.N === 'X' || cell?.N === 'Y')) {
        return { ...row, Cell: cells };
      }

      const point = pagePoints[pointIndex];
      pointIndex += 1;
      if (!point) {
        return { ...row, Cell: cells };
      }

      upsertCellNumber(cells, 'X', point.x);
      upsertCellNumber(cells, 'Y', point.y);
      return { ...row, Cell: cells };
    });

    return { ...section, Row: rows };
  });
}

function normalizeShapeBounds(
  originalCells: any[],
  transformedCells: any[],
  localToPageTransform: PointTransform | undefined
): void {
  if (!localToPageTransform) {
    return;
  }

  const pinX = readCellNumber(originalCells, 'PinX');
  const pinY = readCellNumber(originalCells, 'PinY');
  const width = readCellNumber(originalCells, 'Width');
  const height = readCellNumber(originalCells, 'Height');
  const locPinX = readLocPin(originalCells, 'LocPinX', 'Width');
  const locPinY = readLocPin(originalCells, 'LocPinY', 'Height');
  if ([pinX, pinY, width, height, locPinX, locPinY].some(value => value === undefined)) {
    return;
  }

  const bounds = boundsFromPoints('', [
    localToPageTransform.toPage({ x: 0, y: 0 }),
    localToPageTransform.toPage({ x: width!, y: 0 }),
    localToPageTransform.toPage({ x: width!, y: height! }),
    localToPageTransform.toPage({ x: 0, y: height! })
  ]);
  const normalizedWidth = bounds.right - bounds.left;
  const normalizedHeight = bounds.top - bounds.bottom;
  setCellNumber(transformedCells, 'PinX', (bounds.left + bounds.right) / 2);
  setCellNumber(transformedCells, 'PinY', (bounds.bottom + bounds.top) / 2);
  setCellNumber(transformedCells, 'Width', normalizedWidth);
  setCellNumber(transformedCells, 'Height', normalizedHeight);
  upsertCellNumber(transformedCells, 'LocPinX', normalizedWidth / 2);
  upsertCellNumber(transformedCells, 'LocPinY', normalizedHeight / 2);
  setExistingCellNumber(transformedCells, 'Angle', 0);
  setExistingCellNumber(transformedCells, 'FlipX', 0);
  setExistingCellNumber(transformedCells, 'FlipY', 0);
}

function getShapeBounds(shape: any): ShapeBounds | undefined {
  const cells = toArray(shape?.Cell);
  const width = readCellNumber(cells, 'Width');
  const height = readCellNumber(cells, 'Height');
  const localToPageTransform = createLocalToPageTransform({ Cell: cells });
  if ([width, height].some(value => value === undefined) || !localToPageTransform) {
    return undefined;
  }

  return boundsFromPoints(String(shape?.ID ?? ''), [
    localToPageTransform.toPage({ x: 0, y: 0 }),
    localToPageTransform.toPage({ x: width!, y: 0 }),
    localToPageTransform.toPage({ x: width!, y: height! }),
    localToPageTransform.toPage({ x: 0, y: height! })
  ]);
}

function boundsFromPoints(shapeId: string, points: ConnectorPoint[]): ShapeBounds {
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return {
    shapeId,
    left: Math.min(...xs),
    right: Math.max(...xs),
    bottom: Math.min(...ys),
    top: Math.max(...ys)
  };
}

function getConnectorSegment(shape: any, connectedShapeIds = new Set<string>()): ConnectorSegment | undefined {
  const cells = toArray(shape?.Cell);
  const x1 = readCellNumber(cells, 'BeginX');
  const y1 = readCellNumber(cells, 'BeginY');
  const x2 = readCellNumber(cells, 'EndX');
  const y2 = readCellNumber(cells, 'EndY');
  if ([x1, y1, x2, y2].some(value => value === undefined)) {
    return undefined;
  }

  const routePoints = getConnectorRoutePoints(shape, { x: x1!, y: y1! }, { x: x2!, y: y2! });
  const routeKind = classifyConnectorRoute(routePoints);

  return {
    shapeId: String(shape?.ID ?? ''),
    connectedShapeIds,
    x1: x1!,
    y1: y1!,
    x2: x2!,
    y2: y2!,
    routeKind,
    routeSegmentCount: Math.max(0, routePoints.length - 1),
    routePoints
  };
}

function isDiagonalSegment(segment: ConnectorSegment): boolean {
  return getConnectorRouteSegments(segment).some(routeSegment => isDiagonalRouteSegment(routeSegment.start, routeSegment.end));
}

function getConnectorRoutePoints(shape: any, begin: ConnectorPoint, end: ConnectorPoint): ConnectorPoint[] {
  const geometryPoints = getConnectorGeometryPoints(shape);
  if (shouldUseGeometryRoutePoints(geometryPoints, begin, end)) {
    return removeConsecutiveDuplicatePoints([begin, ...geometryPoints, end]);
  }

  const localGeometryPoints = transformLocalConnectorGeometryPoints(shape, geometryPoints);
  if (localGeometryPoints && shouldUseGeometryRoutePoints(localGeometryPoints, begin, end)) {
    return removeConsecutiveDuplicatePoints([begin, ...localGeometryPoints, end]);
  }

  return [begin, end];
}

function getConnectorGeometryPoints(shape: any): ConnectorPoint[] {
  const points: ConnectorPoint[] = [];
  for (const section of toArray(shape?.Section)) {
    if (String(section?.N ?? '').toLowerCase() !== 'geometry') {
      continue;
    }
    for (const row of toArray(section?.Row)) {
      if (String(row?.Del ?? '') === '1') {
        continue;
      }
      const cells = toArray(row?.Cell);
      const x = readCellNumber(cells, 'X');
      const y = readCellNumber(cells, 'Y');
      if (x === undefined && y === undefined) {
        continue;
      }
      const previous = points[points.length - 1];
      points.push({
        x: x ?? previous?.x ?? 0,
        y: y ?? previous?.y ?? 0
      });
    }
  }
  return points;
}

function transformLocalConnectorGeometryPoints(shape: any, points: ConnectorPoint[]): ConnectorPoint[] | undefined {
  if (points.length === 0) {
    return undefined;
  }

  const cells = toArray(shape?.Cell);
  const pinX = readCellNumber(cells, 'PinX');
  const pinY = readCellNumber(cells, 'PinY');
  const locPinX = readLocPin(cells, 'LocPinX', 'Width');
  const locPinY = readLocPin(cells, 'LocPinY', 'Height');
  if ([pinX, pinY, locPinX, locPinY].some(value => value === undefined)) {
    return undefined;
  }

  const angle = readCellNumber(cells, 'Angle') ?? 0;
  const flipX = readCellNumber(cells, 'FlipX') === 1;
  const flipY = readCellNumber(cells, 'FlipY') === 1;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return points.map(point => {
    const localX = (flipX ? -1 : 1) * (point.x - locPinX!);
    const localY = (flipY ? -1 : 1) * (point.y - locPinY!);
    return {
      x: pinX! + localX * cos - localY * sin,
      y: pinY! + localX * sin + localY * cos
    };
  });
}

function readLocPin(cells: unknown[], locPinName: string, sizeName: string): number | undefined {
  const locPin = readCellNumber(cells, locPinName);
  if (locPin !== undefined) {
    return locPin;
  }

  const size = readCellNumber(cells, sizeName);
  return size !== undefined ? size / 2 : undefined;
}

function shouldUseGeometryRoutePoints(points: ConnectorPoint[], begin: ConnectorPoint, end: ConnectorPoint): boolean {
  if (points.length === 0) {
    return false;
  }

  const first = points[0];
  const last = points[points.length - 1];
  return samePoint(first, begin) || samePoint(last, end);
}

function removeConsecutiveDuplicatePoints(points: ConnectorPoint[]): ConnectorPoint[] {
  const result: ConnectorPoint[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (!previous || !samePoint(previous, point)) {
      result.push(point);
    }
  }
  return result;
}

function classifyConnectorRoute(points: ConnectorPoint[]): ConnectorRouteKind {
  const routeSegments = pointsToRouteSegments(points);
  if (routeSegments.length <= 1) {
    return 'straight';
  }

  const allAxisAligned = routeSegments.every(segment => isAxisAlignedRouteSegment(segment.start, segment.end));
  if (allAxisAligned && routeSegments.length <= 3) {
    return 'orthogonal';
  }
  return 'complex';
}

function getConnectorRouteSegments(segment: ConnectorSegment): Array<{ start: ConnectorPoint; end: ConnectorPoint }> {
  return pointsToRouteSegments(segment.routePoints);
}

function pointsToRouteSegments(points: ConnectorPoint[]): Array<{ start: ConnectorPoint; end: ConnectorPoint }> {
  const segments: Array<{ start: ConnectorPoint; end: ConnectorPoint }> = [];
  for (let index = 1; index < points.length; index += 1) {
    segments.push({ start: points[index - 1], end: points[index] });
  }
  return segments;
}

function isAxisAlignedRouteSegment(start: ConnectorPoint, end: ConnectorPoint): boolean {
  const epsilon = 0.0001;
  return Math.abs(start.x - end.x) <= epsilon || Math.abs(start.y - end.y) <= epsilon;
}

function isDiagonalRouteSegment(start: ConnectorPoint, end: ConnectorPoint): boolean {
  const epsilon = 0.0001;
  return Math.abs(start.x - end.x) > epsilon && Math.abs(start.y - end.y) > epsilon;
}

function samePoint(a: ConnectorPoint, b: ConnectorPoint): boolean {
  const epsilon = 0.0001;
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

function countConnectorCrossings(segments: ConnectorSegment[], shapes: ShapeBounds[]): number {
  let count = 0;
  for (const segment of segments) {
    for (const shape of shapes) {
      if (segment.connectedShapeIds.has(shape.shapeId)) {
        continue;
      }
      if (getConnectorRouteSegments(segment).some(routeSegment => segmentCrossesRect(routeSegment.start, routeSegment.end, shape))) {
        count += 1;
      }
    }
  }
  return count;
}

function countShapeOverlaps(shapes: ShapeBounds[]): number {
  let count = 0;
  for (let index = 0; index < shapes.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < shapes.length; otherIndex += 1) {
      if (rectanglesMeaningfullyOverlap(shapes[index], shapes[otherIndex]) && !rectanglesHaveContainmentRelationship(shapes[index], shapes[otherIndex])) {
        count += 1;
      }
    }
  }
  return count;
}

function rectanglesMeaningfullyOverlap(a: ShapeBounds, b: ShapeBounds): boolean {
  const epsilon = 0.0001;
  const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const yOverlap = Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom);
  if (xOverlap <= epsilon || yOverlap <= epsilon) {
    return false;
  }

  const overlapArea = xOverlap * yOverlap;
  const smallerArea = Math.min(rectArea(a), rectArea(b));
  return smallerArea > 0 && overlapArea / smallerArea >= 0.05;
}

function rectanglesHaveContainmentRelationship(a: ShapeBounds, b: ShapeBounds): boolean {
  return rectangleContains(a, b) || rectangleContains(b, a);
}

function rectangleContains(container: ShapeBounds, child: ShapeBounds): boolean {
  const epsilon = 0.0001;
  return container.left <= child.left + epsilon
    && container.right >= child.right - epsilon
    && container.bottom <= child.bottom + epsilon
    && container.top >= child.top - epsilon;
}

function rectArea(rect: ShapeBounds): number {
  return Math.max(0, rect.right - rect.left) * Math.max(0, rect.top - rect.bottom);
}

function segmentCrossesRect(start: ConnectorPoint, end: ConnectorPoint, rect: ShapeBounds): boolean {
  if (pointInsideRect(start.x, start.y, rect) || pointInsideRect(end.x, end.y, rect)) {
    return false;
  }

  return segmentIntersects(start.x, start.y, end.x, end.y, rect.left, rect.bottom, rect.right, rect.bottom)
    || segmentIntersects(start.x, start.y, end.x, end.y, rect.right, rect.bottom, rect.right, rect.top)
    || segmentIntersects(start.x, start.y, end.x, end.y, rect.right, rect.top, rect.left, rect.top)
    || segmentIntersects(start.x, start.y, end.x, end.y, rect.left, rect.top, rect.left, rect.bottom);
}

function pointInsideRect(x: number, y: number, rect: ShapeBounds): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.bottom && y <= rect.top;
}

function segmentIntersects(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const d1 = direction(cx, cy, dx, dy, ax, ay);
  const d2 = direction(cx, cy, dx, dy, bx, by);
  const d3 = direction(ax, ay, bx, by, cx, cy);
  const d4 = direction(ax, ay, bx, by, dx, dy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
    && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function direction(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (cx - ax) * (by - ay) - (cy - ay) * (bx - ax);
}

function calculatePageCoverageRatio(shapes: ShapeBounds[], pageWidth: number, pageHeight: number): number {
  const pageArea = pageWidth * pageHeight;
  if (pageArea <= 0) {
    return 0;
  }

  const shapeArea = shapes.reduce((sum, shape) => {
    const width = Math.max(0, Math.min(shape.right, pageWidth) - Math.max(shape.left, 0));
    const height = Math.max(0, Math.min(shape.top, pageHeight) - Math.max(shape.bottom, 0));
    return sum + width * height;
  }, 0);
  return Math.min(1, shapeArea / pageArea);
}

function averageDefined(values: Array<number | undefined>): number | undefined {
  const defined = values.filter(isDefined);
  if (defined.length === 0) {
    return undefined;
  }
  return defined.reduce((sum, value) => sum + value, 0) / defined.length;
}

function formatRatio(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function hasVisibleText(shape: any): boolean {
  if (shape?.Text === undefined || shape?.Text === null) {
    return false;
  }
  return String(shape.Text).replace(/\s+/g, '').length > 0;
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

function isShapeOutOfBounds(shape: any, pageWidth?: number, pageHeight?: number): boolean {
  if (!pageWidth || !pageHeight || isConnectorShape(shape)) {
    return false;
  }
  const bounds = getShapeBounds(shape);
  if (!bounds) {
    return false;
  }

  return bounds.left < 0 || bounds.bottom < 0 || bounds.right > pageWidth || bounds.top > pageHeight;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function sortPageEntries(a: string, b: string): number {
  const aNumber = Number(a.match(/page(\d+)\.xml$/i)?.[1] ?? 0);
  const bNumber = Number(b.match(/page(\d+)\.xml$/i)?.[1] ?? 0);
  return aNumber - bNumber;
}
