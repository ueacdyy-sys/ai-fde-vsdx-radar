import * as fs from 'fs/promises';
import * as path from 'path';
import { deflateSync } from 'zlib';
import JSZip from 'jszip';
import { hashFile, updatePreviewRecord } from '../cache/cacheIndex';
import {
  formatPreviewFreshnessSummaryFiles,
  normalizePreviewFreshnessReason,
  summarizePreviewFreshnessReasonsForItems,
  toPreviewFreshnessReasonKeys
} from '../previewFreshnessSummary';
import { toQaSummaryMarkdown } from '../qa/reporter';
import { analyzeVsdx } from '../qa/vsdxParser';
import { CacheIndex, RadarConfig } from '../types';

const VALID_PREVIEW_PNG = createSolidRgbPng(0, 0, 0);
const BLANK_PREVIEW_PNG = createSolidRgbPng(255, 255, 255);
const INVALID_PREVIEW_PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

async function main(): Promise<void> {
  const root = path.resolve(__dirname, '..', '..');
  const fixtureDir = path.join(root, 'test', 'fixtures');
  const fixturePath = path.join(fixtureDir, 'minimal.vsdx');
  const previewPath = path.join(root, '.aifde', 'previews', 'minimal.test.png');
  const routeCorpusPath = path.join(fixtureDir, 'connector-route-corpus.vsdx');
  const routeCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'connector-route-corpus.test.png');
  const businessCorpusPath = path.join(fixtureDir, 'business-process-corpus.vsdx');
  const businessCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'business-process-corpus.test.png');
  const invalidPreviewIntegrityPath = path.join(root, '.aifde', 'previews', 'business-process-invalid-preview.test.png');
  const blankPreviewIntegrityPath = path.join(root, '.aifde', 'previews', 'business-process-blank-preview.test.png');
  const localGeometryCorpusPath = path.join(fixtureDir, 'local-geometry-route-corpus.vsdx');
  const localGeometryCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'local-geometry-route-corpus.test.png');
  const transformedLocalGeometryCorpusPath = path.join(fixtureDir, 'transformed-local-geometry-route-corpus.vsdx');
  const transformedLocalGeometryCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'transformed-local-geometry-route-corpus.test.png');
  const containerCorpusPath = path.join(fixtureDir, 'container-boundary-corpus.vsdx');
  const containerCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'container-boundary-corpus.test.png');
  const endpointConnectorCorpusPath = path.join(fixtureDir, 'endpoint-connector-evidence-corpus.vsdx');
  const endpointConnectorCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'endpoint-connector-evidence-corpus.test.png');
  const groupNestedCorpusPath = path.join(fixtureDir, 'group-nested-corpus.vsdx');
  const groupNestedCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'group-nested-corpus.test.png');
  const groupParentChildConnectsCorpusPath = path.join(fixtureDir, 'group-parent-child-connects-corpus.vsdx');
  const groupParentChildConnectsCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'group-parent-child-connects-corpus.test.png');
  const groupLocalGeometryCorpusPath = path.join(fixtureDir, 'group-local-geometry-route-corpus.vsdx');
  const groupLocalGeometryCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'group-local-geometry-route-corpus.test.png');
  const rotatedGroupLocalGeometryCorpusPath = path.join(fixtureDir, 'rotated-group-local-geometry-route-corpus.vsdx');
  const rotatedGroupLocalGeometryCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'rotated-group-local-geometry-route-corpus.test.png');
  const flippedGroupLocalGeometryCorpusPath = path.join(fixtureDir, 'flipped-group-local-geometry-route-corpus.vsdx');
  const flippedGroupLocalGeometryCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'flipped-group-local-geometry-route-corpus.test.png');
  const nestedTransformedGroupLocalGeometryCorpusPath = path.join(fixtureDir, 'nested-transformed-group-local-geometry-route-corpus.vsdx');
  const nestedTransformedGroupLocalGeometryCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'nested-transformed-group-local-geometry-route-corpus.test.png');
  const duplicateShapeIdMultipageCorpusPath = path.join(fixtureDir, 'duplicate-shape-id-multipage-corpus.vsdx');
  const duplicateShapeIdMultipageCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'duplicate-shape-id-multipage-corpus.test.png');
  const duplicateShapeIdSamePageGroupCorpusPath = path.join(fixtureDir, 'duplicate-shape-id-same-page-group-corpus.vsdx');
  const duplicateShapeIdSamePageGroupCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'duplicate-shape-id-same-page-group-corpus.test.png');
  const duplicateConnectorIdSamePageCorpusPath = path.join(fixtureDir, 'duplicate-connector-id-same-page-corpus.vsdx');
  const duplicateConnectorIdSamePageCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'duplicate-connector-id-same-page-corpus.test.png');
  const invalidConnectsMultipageCorpusPath = path.join(fixtureDir, 'invalid-connects-multipage-corpus.vsdx');
  const invalidConnectsMultipageCorpusPreviewPath = path.join(root, '.aifde', 'previews', 'invalid-connects-multipage-corpus.test.png');
  await fs.mkdir(fixtureDir, { recursive: true });
  await fs.mkdir(path.dirname(previewPath), { recursive: true });
  await fs.writeFile(previewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(routeCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(businessCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(invalidPreviewIntegrityPath, INVALID_PREVIEW_PNG);
  await fs.writeFile(blankPreviewIntegrityPath, BLANK_PREVIEW_PNG);
  await fs.writeFile(localGeometryCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(transformedLocalGeometryCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(containerCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(endpointConnectorCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(groupNestedCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(groupParentChildConnectsCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(groupLocalGeometryCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(rotatedGroupLocalGeometryCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(flippedGroupLocalGeometryCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(nestedTransformedGroupLocalGeometryCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(duplicateShapeIdMultipageCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(duplicateShapeIdSamePageGroupCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(duplicateConnectorIdSamePageCorpusPreviewPath, VALID_PREVIEW_PNG);
  await fs.writeFile(invalidConnectsMultipageCorpusPreviewPath, VALID_PREVIEW_PNG);
  await writeMinimalVsdx(fixturePath);
  await writeConnectorRouteCorpusVsdx(routeCorpusPath);
  await writeBusinessProcessCorpusVsdx(businessCorpusPath);
  await writeLocalGeometryRouteCorpusVsdx(localGeometryCorpusPath);
  await writeTransformedLocalGeometryRouteCorpusVsdx(transformedLocalGeometryCorpusPath);
  await writeContainerBoundaryCorpusVsdx(containerCorpusPath);
  await writeEndpointConnectorEvidenceCorpusVsdx(endpointConnectorCorpusPath);
  await writeGroupNestedCorpusVsdx(groupNestedCorpusPath);
  await writeGroupParentChildConnectsCorpusVsdx(groupParentChildConnectsCorpusPath);
  await writeGroupLocalGeometryRouteCorpusVsdx(groupLocalGeometryCorpusPath);
  await writeRotatedGroupLocalGeometryRouteCorpusVsdx(rotatedGroupLocalGeometryCorpusPath);
  await writeFlippedGroupLocalGeometryRouteCorpusVsdx(flippedGroupLocalGeometryCorpusPath);
  await writeNestedTransformedGroupLocalGeometryRouteCorpusVsdx(nestedTransformedGroupLocalGeometryCorpusPath);
  await writeDuplicateShapeIdMultipageCorpusVsdx(duplicateShapeIdMultipageCorpusPath);
  await writeDuplicateShapeIdSamePageGroupCorpusVsdx(duplicateShapeIdSamePageGroupCorpusPath);
  await writeDuplicateConnectorIdSamePageCorpusVsdx(duplicateConnectorIdSamePageCorpusPath);
  await writeInvalidConnectsMultipageCorpusVsdx(invalidConnectsMultipageCorpusPath);

  const cacheIndex: CacheIndex = {
    version: 1,
    records: {
      [fixturePath]: {
        sourcePath: fixturePath,
        sourceMtimeMs: 1,
        sourceSize: 1,
        previewPath,
        previewMtimeMs: 1,
        previewSize: 8,
        format: 'png',
        updatedAt: new Date().toISOString()
      }
    }
  };

  const config: RadarConfig = {
    pwshPath: 'pwsh',
    outputDirectory: '.aifde',
    previewFormat: 'png',
    qaPreset: 'custom',
    autoExportOnSave: false,
    exportTimeoutMs: 120000,
    shapeDensityWarningThreshold: 80,
    connectorRatioWarningThreshold: 0.25,
    pageCoverageLowWarningThreshold: 0.02,
    pageCoverageHighWarningThreshold: 0.85,
    enableShapeDensityWarning: true,
    enableConnectorRatioWarning: true,
    enableUnlabeledShapeWarning: true,
    enablePageCoverageWarning: true,
    enableDiagonalConnectorWarning: true,
    enableConnectorCrossingWarning: true,
    enableDanglingConnectorWarning: true,
    enableShapeOverlapWarning: true
  };

  const result = await analyzeVsdx(fixturePath, previewPath, cacheIndex, config);
  assert(result.stats.pageCount === 2, 'expected two pages');
  assert(result.stats.shapeCount === 8, 'expected eight shapes');
  assert(result.stats.textShapeCount === 4, 'expected four text shapes');
  assert(result.stats.unlabeledShapeCount === 1, 'expected one unlabeled shape');
  assert(result.stats.oneDShapeCount === 3, 'expected three OneD shapes');
  assert(result.stats.connectCount === 2, 'expected two connects');
  assert(result.stats.outOfBoundsShapeCount === 1, 'expected one out-of-bounds shape');
  assert(result.stats.diagonalConnectorCount === 1, 'expected one diagonal connector');
  assert(result.stats.connectorCrossingCount === 1, 'expected one connector crossing');
  assert(result.stats.danglingConnectorCount === 1, 'expected one dangling connector');
  assert(result.stats.straightConnectorCount === 2, 'expected two straight connectors');
  assert(result.stats.orthogonalConnectorCount === 1, 'expected one orthogonal connector');
  assert(result.stats.complexConnectorCount === 0, 'expected no complex connector');
  assert(result.stats.shapeOverlapPairCount === 1, 'expected one shape overlap pair');
  assert(result.stats.averagePageCoverageRatio !== undefined && result.stats.averagePageCoverageRatio > 0, 'expected average page coverage');
  assert(result.previewExists, 'expected preview to exist');
  assert(result.risks.some(risk => risk.code === 'MULTIPAGE_PREVIEW_INCOMPLETE'), 'expected multi-page warning');
  assert(result.risks.some(risk => risk.code === 'UNLABELED_SHAPES'), 'expected unlabeled shape warning');
  assert(result.risks.some(risk => risk.code === 'SHAPE_OUT_OF_BOUNDS'), 'expected out-of-bounds error');
  assert(result.risks.some(risk => risk.code === 'DIAGONAL_CONNECTORS'), 'expected diagonal connector warning');
  assert(result.risks.some(risk => risk.code === 'CONNECTOR_CROSSES_SHAPE'), 'expected connector crossing warning');
  assert(result.risks.some(risk => risk.code === 'DANGLING_CONNECTORS'), 'expected dangling connector warning');
  assert(result.risks.some(risk => risk.code === 'SHAPE_OVERLAP'), 'expected shape overlap warning');
  assert(result.risks.some(risk => risk.code === 'PAGE_COVERAGE_LOW'), 'expected low page coverage warning');

  const geometryDisabledResult = await analyzeVsdx(fixturePath, previewPath, cacheIndex, {
    ...config,
    pageCoverageLowWarningThreshold: 0,
    enableDiagonalConnectorWarning: false,
    enableConnectorCrossingWarning: false,
    enableDanglingConnectorWarning: false,
    enableShapeOverlapWarning: false
  });
  assert(geometryDisabledResult.stats.diagonalConnectorCount === 1, 'expected diagonal connector stat to remain');
  assert(geometryDisabledResult.stats.connectorCrossingCount === 1, 'expected connector crossing stat to remain');
  assert(geometryDisabledResult.stats.danglingConnectorCount === 1, 'expected dangling connector stat to remain');
  assert(geometryDisabledResult.stats.straightConnectorCount === 2, 'expected straight connector stat to remain');
  assert(geometryDisabledResult.stats.orthogonalConnectorCount === 1, 'expected orthogonal connector stat to remain');
  assert(geometryDisabledResult.stats.complexConnectorCount === 0, 'expected complex connector stat to remain');
  assert(geometryDisabledResult.stats.shapeOverlapPairCount === 1, 'expected shape overlap stat to remain');
  assert(!geometryDisabledResult.risks.some(risk => risk.code === 'DIAGONAL_CONNECTORS'), 'expected diagonal connector warning to be disabled');
  assert(!geometryDisabledResult.risks.some(risk => risk.code === 'CONNECTOR_CROSSES_SHAPE'), 'expected connector crossing warning to be disabled');
  assert(!geometryDisabledResult.risks.some(risk => risk.code === 'DANGLING_CONNECTORS'), 'expected dangling connector warning to be disabled');
  assert(!geometryDisabledResult.risks.some(risk => risk.code === 'SHAPE_OVERLAP'), 'expected shape overlap warning to be disabled');
  assert(!geometryDisabledResult.risks.some(risk => risk.code === 'PAGE_COVERAGE_LOW'), 'expected low page coverage warning to be disabled by threshold');

  const structuralDisabledResult = await analyzeVsdx(fixturePath, previewPath, cacheIndex, {
    ...config,
    shapeDensityWarningThreshold: 1,
    connectorRatioWarningThreshold: 0.9,
    enableShapeDensityWarning: false,
    enableConnectorRatioWarning: false,
    enableUnlabeledShapeWarning: false,
    enablePageCoverageWarning: false
  });
  assert(structuralDisabledResult.stats.unlabeledShapeCount === 1, 'expected unlabeled stat to remain');
  assert(structuralDisabledResult.stats.averagePageCoverageRatio !== undefined, 'expected page coverage stat to remain');
  assert(!structuralDisabledResult.risks.some(risk => risk.code === 'SHAPE_DENSITY_HIGH'), 'expected shape density warning to be disabled');
  assert(!structuralDisabledResult.risks.some(risk => risk.code === 'CONNECTOR_RATIO_LOW'), 'expected connector ratio warning to be disabled');
  assert(!structuralDisabledResult.risks.some(risk => risk.code === 'UNLABELED_SHAPES'), 'expected unlabeled shape warning to be disabled');
  assert(!structuralDisabledResult.risks.some(risk => risk.code === 'PAGE_COVERAGE_LOW' || risk.code === 'PAGE_COVERAGE_HIGH'), 'expected page coverage warning to be disabled');

  const routeCorpusResult = await analyzeVsdx(routeCorpusPath, routeCorpusPreviewPath, await createSinglePreviewCacheIndex(routeCorpusPath, routeCorpusPreviewPath), config);
  assert(routeCorpusResult.stats.pageCount === 1, 'expected one route corpus page');
  assert(routeCorpusResult.stats.shapeCount === 3, 'expected three route corpus shapes');
  assert(routeCorpusResult.stats.textShapeCount === 2, 'expected two route corpus text shapes');
  assert(routeCorpusResult.stats.unlabeledShapeCount === 0, 'expected no route corpus unlabeled shapes');
  assert(routeCorpusResult.stats.oneDShapeCount === 1, 'expected one route corpus OneD shape');
  assert(routeCorpusResult.stats.connectCount === 2, 'expected two route corpus connects');
  assert(routeCorpusResult.stats.straightConnectorCount === 0, 'expected no straight route corpus connectors');
  assert(routeCorpusResult.stats.orthogonalConnectorCount === 0, 'expected no short orthogonal route corpus connectors');
  assert(routeCorpusResult.stats.complexConnectorCount === 1, 'expected one complex route corpus connector');
  assert(routeCorpusResult.stats.diagonalConnectorCount === 0, 'expected no diagonal route corpus connector');
  assert(routeCorpusResult.stats.connectorCrossingCount === 0, 'expected no route corpus connector crossing');
  assert(routeCorpusResult.stats.danglingConnectorCount === 0, 'expected no route corpus dangling connector');
  assert(routeCorpusResult.previewExists, 'expected route corpus preview to exist');
  assert(routeCorpusResult.previewFresh, 'expected route corpus preview to be fresh');
  assert(!routeCorpusResult.risks.some(risk => risk.code === 'DIAGONAL_CONNECTORS'), 'expected route corpus not to warn about diagonal connectors');
  assert(!routeCorpusResult.risks.some(risk => risk.code === 'CONNECTOR_CROSSES_SHAPE'), 'expected route corpus not to warn about connector crossings');
  assert(!routeCorpusResult.risks.some(risk => risk.code === 'DANGLING_CONNECTORS'), 'expected route corpus not to warn about dangling connectors');
  assert(!routeCorpusResult.risks.some(risk => risk.code === 'PAGE_COVERAGE_LOW'), 'expected route corpus not to warn about low page coverage');

  const businessCorpusCacheIndex = await createSinglePreviewCacheIndex(businessCorpusPath, businessCorpusPreviewPath);
  const businessCorpusResult = await analyzeVsdx(businessCorpusPath, businessCorpusPreviewPath, businessCorpusCacheIndex, config);
  assert(businessCorpusResult.stats.pageCount === 1, 'expected one business corpus page');
  assert(businessCorpusResult.stats.shapeCount === 9, 'expected nine business corpus shapes');
  assert(businessCorpusResult.stats.textShapeCount === 6, 'expected six business corpus text shapes');
  assert(businessCorpusResult.stats.unlabeledShapeCount === 0, 'expected no business corpus unlabeled shapes');
  assert(businessCorpusResult.stats.oneDShapeCount === 3, 'expected three business corpus OneD shapes');
  assert(businessCorpusResult.stats.connectCount === 6, 'expected six business corpus connects');
  assert(businessCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no business corpus out-of-bounds shapes');
  assert(businessCorpusResult.stats.straightConnectorCount === 3, 'expected three straight business corpus connectors');
  assert(businessCorpusResult.stats.orthogonalConnectorCount === 0, 'expected no orthogonal business corpus connectors');
  assert(businessCorpusResult.stats.complexConnectorCount === 0, 'expected no complex business corpus connectors');
  assert(businessCorpusResult.stats.diagonalConnectorCount === 0, 'expected no diagonal business corpus connectors');
  assert(businessCorpusResult.stats.connectorCrossingCount === 0, 'expected no business corpus connector crossing');
  assert(businessCorpusResult.stats.danglingConnectorCount === 0, 'expected no business corpus dangling connector');
  assert(businessCorpusResult.stats.shapeOverlapPairCount === 0, 'expected no business corpus shape overlaps');
  assert(businessCorpusResult.stats.averagePageCoverageRatio !== undefined && businessCorpusResult.stats.averagePageCoverageRatio > config.pageCoverageLowWarningThreshold, 'expected business corpus page coverage above low threshold');
  assert(businessCorpusResult.previewExists, 'expected business corpus preview to exist');
  assert(businessCorpusResult.previewFresh, 'expected business corpus preview to be fresh');
  assert(businessCorpusResult.previewFreshnessReasons?.length === 0, 'expected fresh preview to have no freshness reasons');
  assert(businessCorpusResult.risks.length === 0, 'expected business corpus to have no risks');

  const recordedPreviewCacheIndex: CacheIndex = { version: 1, records: {} };
  const recordedPreview = await updatePreviewRecord(recordedPreviewCacheIndex, businessCorpusPath, businessCorpusPreviewPath, 'png');
  assert(recordedPreview.sourceHash !== undefined && recordedPreview.sourceHash.startsWith('sha256:'), 'expected preview cache record to include source hash');
  assert(recordedPreview.previewWidth === 1, 'expected preview cache record to include PNG width');
  assert(recordedPreview.previewHeight === 1, 'expected preview cache record to include PNG height');
  assert(recordedPreview.previewHasVisibleContent === true, 'expected preview cache record to include nonblank PNG evidence');

  const staleHashCacheIndex = await createSinglePreviewCacheIndex(businessCorpusPath, businessCorpusPreviewPath);
  staleHashCacheIndex.records[businessCorpusPath].sourceHash = 'sha256:stale';
  const staleHashBusinessCorpusResult = await analyzeVsdx(businessCorpusPath, businessCorpusPreviewPath, staleHashCacheIndex, config);
  assert(!staleHashBusinessCorpusResult.previewFresh, 'expected source hash mismatch to mark preview stale');
  assert(staleHashBusinessCorpusResult.previewFreshnessReasons?.some(reason => reason.includes('source hash changed')) === true, 'expected source hash mismatch to record freshness reason');
  assert(staleHashBusinessCorpusResult.risks.some(risk => risk.code === 'PREVIEW_STALE'), 'expected source hash mismatch to surface preview stale warning');
  assert(staleHashBusinessCorpusResult.risks.some(risk => risk.code === 'PREVIEW_STALE' && risk.message.includes('source hash changed')), 'expected source hash mismatch reason in stale risk message');
  const staleHashSummary = toQaSummaryMarkdown(staleHashBusinessCorpusResult);
  assert(staleHashSummary.includes('## Preview Freshness'), 'expected QA summary to include preview freshness section');
  assert(staleHashSummary.includes('source hash changed'), 'expected QA summary to include preview freshness reason');

  const invalidPreviewCacheIndex = await createSinglePreviewCacheIndex(businessCorpusPath, invalidPreviewIntegrityPath);
  const invalidPreviewBusinessCorpusResult = await analyzeVsdx(businessCorpusPath, invalidPreviewIntegrityPath, invalidPreviewCacheIndex, config);
  assert(invalidPreviewBusinessCorpusResult.previewExists, 'expected invalid preview path to exist');
  assert(!invalidPreviewBusinessCorpusResult.previewFresh, 'expected invalid PNG preview to mark preview stale');
  assert(invalidPreviewBusinessCorpusResult.previewFreshnessReasons?.some(reason => reason.includes('PNG file is too small')) === true, 'expected invalid PNG reason to be recorded');
  assert(invalidPreviewBusinessCorpusResult.risks.some(risk => risk.code === 'PREVIEW_STALE'), 'expected invalid PNG preview to surface preview stale warning');

  const blankPreviewCacheIndex = await createSinglePreviewCacheIndex(businessCorpusPath, blankPreviewIntegrityPath);
  const blankPreviewBusinessCorpusResult = await analyzeVsdx(businessCorpusPath, blankPreviewIntegrityPath, blankPreviewCacheIndex, config);
  assert(blankPreviewBusinessCorpusResult.previewExists, 'expected blank preview path to exist');
  assert(!blankPreviewBusinessCorpusResult.previewFresh, 'expected blank PNG preview to mark preview stale');
  assert(blankPreviewBusinessCorpusResult.previewFreshnessReasons?.some(reason => reason.includes('blank PNG image data')) === true, 'expected blank PNG reason to be recorded');
  assert(blankPreviewBusinessCorpusResult.risks.some(risk => risk.code === 'PREVIEW_STALE'), 'expected blank PNG preview to surface preview stale warning');
  assertPreviewFreshnessSummaryHelpers();

  const localGeometryCorpusResult = await analyzeVsdx(localGeometryCorpusPath, localGeometryCorpusPreviewPath, await createSinglePreviewCacheIndex(localGeometryCorpusPath, localGeometryCorpusPreviewPath), config);
  assert(localGeometryCorpusResult.stats.pageCount === 1, 'expected one local geometry corpus page');
  assert(localGeometryCorpusResult.stats.shapeCount === 3, 'expected three local geometry corpus shapes');
  assert(localGeometryCorpusResult.stats.textShapeCount === 2, 'expected two local geometry corpus text shapes');
  assert(localGeometryCorpusResult.stats.unlabeledShapeCount === 0, 'expected no local geometry corpus unlabeled shapes');
  assert(localGeometryCorpusResult.stats.oneDShapeCount === 0, 'expected no local geometry corpus OneD shapes');
  assert(localGeometryCorpusResult.stats.connectCount === 2, 'expected two local geometry corpus connects');
  assert(localGeometryCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no local geometry corpus out-of-bounds shapes');
  assert(localGeometryCorpusResult.stats.straightConnectorCount === 0, 'expected no straight local geometry corpus connectors');
  assert(localGeometryCorpusResult.stats.orthogonalConnectorCount === 1, 'expected one orthogonal local geometry corpus connector');
  assert(localGeometryCorpusResult.stats.complexConnectorCount === 0, 'expected no complex local geometry corpus connectors');
  assert(localGeometryCorpusResult.stats.diagonalConnectorCount === 0, 'expected no diagonal local geometry corpus connectors');
  assert(localGeometryCorpusResult.stats.connectorCrossingCount === 0, 'expected no local geometry corpus connector crossing');
  assert(localGeometryCorpusResult.stats.danglingConnectorCount === 0, 'expected no local geometry corpus dangling connector');
  assert(localGeometryCorpusResult.stats.shapeOverlapPairCount === 0, 'expected no local geometry corpus shape overlaps');
  assert(localGeometryCorpusResult.previewExists, 'expected local geometry corpus preview to exist');
  assert(localGeometryCorpusResult.previewFresh, 'expected local geometry corpus preview to be fresh');
  assert(localGeometryCorpusResult.risks.length === 0, 'expected local geometry corpus to have no risks');

  const transformedLocalGeometryCorpusResult = await analyzeVsdx(transformedLocalGeometryCorpusPath, transformedLocalGeometryCorpusPreviewPath, await createSinglePreviewCacheIndex(transformedLocalGeometryCorpusPath, transformedLocalGeometryCorpusPreviewPath), config);
  assert(transformedLocalGeometryCorpusResult.stats.pageCount === 1, 'expected one transformed local geometry corpus page');
  assert(transformedLocalGeometryCorpusResult.stats.shapeCount === 6, 'expected six transformed local geometry corpus shapes');
  assert(transformedLocalGeometryCorpusResult.stats.textShapeCount === 4, 'expected four transformed local geometry corpus text shapes');
  assert(transformedLocalGeometryCorpusResult.stats.unlabeledShapeCount === 0, 'expected no transformed local geometry corpus unlabeled shapes');
  assert(transformedLocalGeometryCorpusResult.stats.oneDShapeCount === 0, 'expected no transformed local geometry corpus OneD shapes');
  assert(transformedLocalGeometryCorpusResult.stats.connectCount === 4, 'expected four transformed local geometry corpus connects');
  assert(transformedLocalGeometryCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no transformed local geometry corpus out-of-bounds shapes');
  assert(transformedLocalGeometryCorpusResult.stats.straightConnectorCount === 0, 'expected no straight transformed local geometry corpus connectors');
  assert(transformedLocalGeometryCorpusResult.stats.orthogonalConnectorCount === 2, 'expected two orthogonal transformed local geometry corpus connectors');
  assert(transformedLocalGeometryCorpusResult.stats.complexConnectorCount === 0, 'expected no complex transformed local geometry corpus connectors');
  assert(transformedLocalGeometryCorpusResult.stats.diagonalConnectorCount === 0, 'expected no diagonal transformed local geometry corpus connectors');
  assert(transformedLocalGeometryCorpusResult.stats.connectorCrossingCount === 0, 'expected no transformed local geometry corpus connector crossing');
  assert(transformedLocalGeometryCorpusResult.stats.danglingConnectorCount === 0, 'expected no transformed local geometry corpus dangling connector');
  assert(transformedLocalGeometryCorpusResult.stats.shapeOverlapPairCount === 0, 'expected no transformed local geometry corpus shape overlaps');
  assert(transformedLocalGeometryCorpusResult.previewExists, 'expected transformed local geometry corpus preview to exist');
  assert(transformedLocalGeometryCorpusResult.previewFresh, 'expected transformed local geometry corpus preview to be fresh');
  assert(transformedLocalGeometryCorpusResult.risks.length === 0, 'expected transformed local geometry corpus to have no risks');

  const containerCorpusResult = await analyzeVsdx(containerCorpusPath, containerCorpusPreviewPath, await createSinglePreviewCacheIndex(containerCorpusPath, containerCorpusPreviewPath), config);
  assert(containerCorpusResult.stats.pageCount === 1, 'expected one container corpus page');
  assert(containerCorpusResult.stats.shapeCount === 4, 'expected four container corpus shapes');
  assert(containerCorpusResult.stats.textShapeCount === 3, 'expected three container corpus text shapes');
  assert(containerCorpusResult.stats.unlabeledShapeCount === 0, 'expected no container corpus unlabeled shapes');
  assert(containerCorpusResult.stats.oneDShapeCount === 1, 'expected one container corpus OneD shape');
  assert(containerCorpusResult.stats.connectCount === 2, 'expected two container corpus connects');
  assert(containerCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no container corpus out-of-bounds shapes');
  assert(containerCorpusResult.stats.straightConnectorCount === 1, 'expected one straight container corpus connector');
  assert(containerCorpusResult.stats.orthogonalConnectorCount === 0, 'expected no orthogonal container corpus connectors');
  assert(containerCorpusResult.stats.complexConnectorCount === 0, 'expected no complex container corpus connectors');
  assert(containerCorpusResult.stats.diagonalConnectorCount === 0, 'expected no diagonal container corpus connectors');
  assert(containerCorpusResult.stats.connectorCrossingCount === 0, 'expected no container corpus connector crossing');
  assert(containerCorpusResult.stats.danglingConnectorCount === 0, 'expected no container corpus dangling connector');
  assert(containerCorpusResult.stats.shapeOverlapPairCount === 0, 'expected container containment not to count as shape overlap');
  assert(containerCorpusResult.previewExists, 'expected container corpus preview to exist');
  assert(containerCorpusResult.previewFresh, 'expected container corpus preview to be fresh');
  assert(containerCorpusResult.risks.length === 0, 'expected container corpus to have no risks');

  const endpointConnectorCorpusResult = await analyzeVsdx(endpointConnectorCorpusPath, endpointConnectorCorpusPreviewPath, await createSinglePreviewCacheIndex(endpointConnectorCorpusPath, endpointConnectorCorpusPreviewPath), config);
  assert(endpointConnectorCorpusResult.stats.pageCount === 1, 'expected one endpoint connector corpus page');
  assert(endpointConnectorCorpusResult.stats.shapeCount === 6, 'expected six endpoint connector corpus shapes');
  assert(endpointConnectorCorpusResult.stats.textShapeCount === 5, 'expected five endpoint connector corpus text shapes');
  assert(endpointConnectorCorpusResult.stats.unlabeledShapeCount === 0, 'expected no endpoint connector corpus unlabeled shapes');
  assert(endpointConnectorCorpusResult.stats.oneDShapeCount === 0, 'expected no endpoint connector corpus OneD shapes');
  assert(endpointConnectorCorpusResult.stats.connectCount === 0, 'expected no endpoint connector corpus connects');
  assert(endpointConnectorCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no endpoint connector corpus out-of-bounds shapes');
  assert(endpointConnectorCorpusResult.stats.straightConnectorCount === 1, 'expected one straight endpoint connector corpus connector');
  assert(endpointConnectorCorpusResult.stats.orthogonalConnectorCount === 0, 'expected no orthogonal endpoint connector corpus connectors');
  assert(endpointConnectorCorpusResult.stats.complexConnectorCount === 0, 'expected no complex endpoint connector corpus connectors');
  assert(endpointConnectorCorpusResult.stats.diagonalConnectorCount === 0, 'expected no diagonal endpoint connector corpus connectors');
  assert(endpointConnectorCorpusResult.stats.connectorCrossingCount === 0, 'expected no endpoint connector corpus connector crossing');
  assert(endpointConnectorCorpusResult.stats.danglingConnectorCount === 1, 'expected one endpoint connector corpus dangling connector');
  assert(endpointConnectorCorpusResult.stats.shapeOverlapPairCount === 0, 'expected no endpoint connector corpus shape overlaps');
  assert(endpointConnectorCorpusResult.previewExists, 'expected endpoint connector corpus preview to exist');
  assert(endpointConnectorCorpusResult.previewFresh, 'expected endpoint connector corpus preview to be fresh');
  assert(endpointConnectorCorpusResult.risks.some(risk => risk.code === 'DANGLING_CONNECTORS'), 'expected endpoint connector corpus dangling warning');
  assert(endpointConnectorCorpusResult.risks.some(risk => risk.code === 'CONNECTOR_RATIO_LOW'), 'expected endpoint connector corpus connector ratio warning');
  assert(!endpointConnectorCorpusResult.risks.some(risk => risk.code === 'NO_CONNECTORS'), 'expected endpoint connector evidence not to warn about missing connectors');
  assert(!endpointConnectorCorpusResult.risks.some(risk => risk.code === 'UNLABELED_SHAPES'), 'expected endpoint connector corpus not to warn about unlabeled connector shape');

  const groupNestedCorpusResult = await analyzeVsdx(groupNestedCorpusPath, groupNestedCorpusPreviewPath, await createSinglePreviewCacheIndex(groupNestedCorpusPath, groupNestedCorpusPreviewPath), config);
  assert(groupNestedCorpusResult.stats.pageCount === 1, 'expected one group nested corpus page');
  assert(groupNestedCorpusResult.stats.shapeCount === 4, 'expected four group nested corpus shapes');
  assert(groupNestedCorpusResult.stats.textShapeCount === 3, 'expected three group nested corpus text shapes');
  assert(groupNestedCorpusResult.stats.unlabeledShapeCount === 0, 'expected no group nested corpus unlabeled shapes');
  assert(groupNestedCorpusResult.stats.oneDShapeCount === 0, 'expected no group nested corpus OneD shapes');
  assert(groupNestedCorpusResult.stats.connectCount === 2, 'expected two group nested corpus connects');
  assert(groupNestedCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no group nested corpus out-of-bounds shapes');
  assert(groupNestedCorpusResult.stats.straightConnectorCount === 1, 'expected one straight group nested corpus connector');
  assert(groupNestedCorpusResult.stats.orthogonalConnectorCount === 0, 'expected no orthogonal group nested corpus connectors');
  assert(groupNestedCorpusResult.stats.complexConnectorCount === 0, 'expected no complex group nested corpus connectors');
  assert(groupNestedCorpusResult.stats.diagonalConnectorCount === 0, 'expected no diagonal group nested corpus connectors');
  assert(groupNestedCorpusResult.stats.connectorCrossingCount === 0, 'expected no group nested corpus connector crossing');
  assert(groupNestedCorpusResult.stats.danglingConnectorCount === 0, 'expected no group nested corpus dangling connector');
  assert(groupNestedCorpusResult.stats.shapeOverlapPairCount === 0, 'expected group boundary containment not to count as shape overlap');
  assert(groupNestedCorpusResult.previewExists, 'expected group nested corpus preview to exist');
  assert(groupNestedCorpusResult.previewFresh, 'expected group nested corpus preview to be fresh');
  assert(groupNestedCorpusResult.risks.length === 0, 'expected group nested corpus to have no risks');

  const groupParentChildConnectsCorpusResult = await analyzeVsdx(groupParentChildConnectsCorpusPath, groupParentChildConnectsCorpusPreviewPath, await createSinglePreviewCacheIndex(groupParentChildConnectsCorpusPath, groupParentChildConnectsCorpusPreviewPath), config);
  assert(groupParentChildConnectsCorpusResult.stats.pageCount === 1, 'expected one group parent child connects corpus page');
  assert(groupParentChildConnectsCorpusResult.stats.shapeCount === 3, 'expected three group parent child connects corpus shapes');
  assert(groupParentChildConnectsCorpusResult.stats.textShapeCount === 2, 'expected two group parent child connects corpus text shapes');
  assert(groupParentChildConnectsCorpusResult.stats.unlabeledShapeCount === 0, 'expected no group parent child connects corpus unlabeled shapes');
  assert(groupParentChildConnectsCorpusResult.stats.oneDShapeCount === 0, 'expected no group parent child connects corpus OneD shapes');
  assert(groupParentChildConnectsCorpusResult.stats.connectCount === 2, 'expected two group parent child connects corpus connects');
  assert(groupParentChildConnectsCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no group parent child connects corpus out-of-bounds shapes');
  assert(groupParentChildConnectsCorpusResult.stats.straightConnectorCount === 1, 'expected one straight group parent child connects corpus connector');
  assert(groupParentChildConnectsCorpusResult.stats.orthogonalConnectorCount === 0, 'expected no group parent child connects corpus orthogonal connectors');
  assert(groupParentChildConnectsCorpusResult.stats.complexConnectorCount === 0, 'expected no group parent child connects corpus complex connectors');
  assert(groupParentChildConnectsCorpusResult.stats.diagonalConnectorCount === 0, 'expected no group parent child connects corpus diagonal connectors');
  assert(groupParentChildConnectsCorpusResult.stats.connectorCrossingCount === 0, 'expected parent and child Connects to suppress legal group endpoint crossings');
  assert(groupParentChildConnectsCorpusResult.stats.danglingConnectorCount === 0, 'expected no group parent child connects corpus dangling connector');
  assert(groupParentChildConnectsCorpusResult.stats.shapeOverlapPairCount === 0, 'expected group parent child containment not to count as shape overlap');
  assert(groupParentChildConnectsCorpusResult.previewExists, 'expected group parent child connects corpus preview to exist');
  assert(groupParentChildConnectsCorpusResult.previewFresh, 'expected group parent child connects corpus preview to be fresh');
  assert(groupParentChildConnectsCorpusResult.risks.length === 0, 'expected group parent child connects corpus to have no risks');

  const groupLocalGeometryCorpusResult = await analyzeVsdx(groupLocalGeometryCorpusPath, groupLocalGeometryCorpusPreviewPath, await createSinglePreviewCacheIndex(groupLocalGeometryCorpusPath, groupLocalGeometryCorpusPreviewPath), config);
  assert(groupLocalGeometryCorpusResult.stats.pageCount === 1, 'expected one group local geometry corpus page');
  assert(groupLocalGeometryCorpusResult.stats.shapeCount === 4, 'expected four group local geometry corpus shapes');
  assert(groupLocalGeometryCorpusResult.stats.textShapeCount === 3, 'expected three group local geometry corpus text shapes');
  assert(groupLocalGeometryCorpusResult.stats.unlabeledShapeCount === 0, 'expected no group local geometry corpus unlabeled shapes');
  assert(groupLocalGeometryCorpusResult.stats.oneDShapeCount === 0, 'expected no group local geometry corpus OneD shapes');
  assert(groupLocalGeometryCorpusResult.stats.connectCount === 2, 'expected two group local geometry corpus connects');
  assert(groupLocalGeometryCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no group local geometry corpus out-of-bounds shapes');
  assert(groupLocalGeometryCorpusResult.stats.straightConnectorCount === 0, 'expected no straight group local geometry corpus connector');
  assert(groupLocalGeometryCorpusResult.stats.orthogonalConnectorCount === 1, 'expected one orthogonal group local geometry corpus connector');
  assert(groupLocalGeometryCorpusResult.stats.complexConnectorCount === 0, 'expected no complex group local geometry corpus connector');
  assert(groupLocalGeometryCorpusResult.stats.diagonalConnectorCount === 0, 'expected no diagonal group local geometry corpus connector');
  assert(groupLocalGeometryCorpusResult.stats.connectorCrossingCount === 0, 'expected no group local geometry corpus connector crossing');
  assert(groupLocalGeometryCorpusResult.stats.danglingConnectorCount === 0, 'expected no group local geometry corpus dangling connector');
  assert(groupLocalGeometryCorpusResult.stats.shapeOverlapPairCount === 0, 'expected group local geometry containment not to count as shape overlap');
  assert(groupLocalGeometryCorpusResult.previewExists, 'expected group local geometry corpus preview to exist');
  assert(groupLocalGeometryCorpusResult.previewFresh, 'expected group local geometry corpus preview to be fresh');
  assert(groupLocalGeometryCorpusResult.risks.length === 0, 'expected group local geometry corpus to have no risks');

  const rotatedGroupLocalGeometryCorpusResult = await analyzeVsdx(rotatedGroupLocalGeometryCorpusPath, rotatedGroupLocalGeometryCorpusPreviewPath, await createSinglePreviewCacheIndex(rotatedGroupLocalGeometryCorpusPath, rotatedGroupLocalGeometryCorpusPreviewPath), config);
  assert(rotatedGroupLocalGeometryCorpusResult.stats.pageCount === 1, 'expected one rotated group local geometry corpus page');
  assert(rotatedGroupLocalGeometryCorpusResult.stats.shapeCount === 4, 'expected four rotated group local geometry corpus shapes');
  assert(rotatedGroupLocalGeometryCorpusResult.stats.textShapeCount === 3, 'expected three rotated group local geometry corpus text shapes');
  assert(rotatedGroupLocalGeometryCorpusResult.stats.unlabeledShapeCount === 0, 'expected no rotated group local geometry corpus unlabeled shapes');
  assert(rotatedGroupLocalGeometryCorpusResult.stats.oneDShapeCount === 0, 'expected no rotated group local geometry corpus OneD shapes');
  assert(rotatedGroupLocalGeometryCorpusResult.stats.connectCount === 2, 'expected two rotated group local geometry corpus connects');
  assert(rotatedGroupLocalGeometryCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no rotated group local geometry corpus out-of-bounds shapes');
  assert(rotatedGroupLocalGeometryCorpusResult.stats.straightConnectorCount === 0, 'expected no straight rotated group local geometry corpus connector');
  assert(rotatedGroupLocalGeometryCorpusResult.stats.orthogonalConnectorCount === 1, 'expected one orthogonal rotated group local geometry corpus connector');
  assert(rotatedGroupLocalGeometryCorpusResult.stats.complexConnectorCount === 0, 'expected no complex rotated group local geometry corpus connector');
  assert(rotatedGroupLocalGeometryCorpusResult.stats.diagonalConnectorCount === 0, 'expected no diagonal rotated group local geometry corpus connector');
  assert(rotatedGroupLocalGeometryCorpusResult.stats.connectorCrossingCount === 0, 'expected no rotated group local geometry corpus connector crossing');
  assert(rotatedGroupLocalGeometryCorpusResult.stats.danglingConnectorCount === 0, 'expected no rotated group local geometry corpus dangling connector');
  assert(rotatedGroupLocalGeometryCorpusResult.stats.shapeOverlapPairCount === 0, 'expected rotated group local geometry containment not to count as shape overlap');
  assert(rotatedGroupLocalGeometryCorpusResult.previewExists, 'expected rotated group local geometry corpus preview to exist');
  assert(rotatedGroupLocalGeometryCorpusResult.previewFresh, 'expected rotated group local geometry corpus preview to be fresh');
  assert(rotatedGroupLocalGeometryCorpusResult.risks.length === 0, 'expected rotated group local geometry corpus to have no risks');

  const flippedGroupLocalGeometryCorpusResult = await analyzeVsdx(flippedGroupLocalGeometryCorpusPath, flippedGroupLocalGeometryCorpusPreviewPath, await createSinglePreviewCacheIndex(flippedGroupLocalGeometryCorpusPath, flippedGroupLocalGeometryCorpusPreviewPath), config);
  assert(flippedGroupLocalGeometryCorpusResult.stats.pageCount === 1, 'expected one flipped group local geometry corpus page');
  assert(flippedGroupLocalGeometryCorpusResult.stats.shapeCount === 4, 'expected four flipped group local geometry corpus shapes');
  assert(flippedGroupLocalGeometryCorpusResult.stats.textShapeCount === 3, 'expected three flipped group local geometry corpus text shapes');
  assert(flippedGroupLocalGeometryCorpusResult.stats.unlabeledShapeCount === 0, 'expected no flipped group local geometry corpus unlabeled shapes');
  assert(flippedGroupLocalGeometryCorpusResult.stats.oneDShapeCount === 0, 'expected no flipped group local geometry corpus OneD shapes');
  assert(flippedGroupLocalGeometryCorpusResult.stats.connectCount === 2, 'expected two flipped group local geometry corpus connects');
  assert(flippedGroupLocalGeometryCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no flipped group local geometry corpus out-of-bounds shapes');
  assert(flippedGroupLocalGeometryCorpusResult.stats.straightConnectorCount === 0, 'expected no straight flipped group local geometry corpus connector');
  assert(flippedGroupLocalGeometryCorpusResult.stats.orthogonalConnectorCount === 1, 'expected one orthogonal flipped group local geometry corpus connector');
  assert(flippedGroupLocalGeometryCorpusResult.stats.complexConnectorCount === 0, 'expected no complex flipped group local geometry corpus connector');
  assert(flippedGroupLocalGeometryCorpusResult.stats.diagonalConnectorCount === 0, 'expected no diagonal flipped group local geometry corpus connector');
  assert(flippedGroupLocalGeometryCorpusResult.stats.connectorCrossingCount === 0, 'expected no flipped group local geometry corpus connector crossing');
  assert(flippedGroupLocalGeometryCorpusResult.stats.danglingConnectorCount === 0, 'expected no flipped group local geometry corpus dangling connector');
  assert(flippedGroupLocalGeometryCorpusResult.stats.shapeOverlapPairCount === 0, 'expected flipped group local geometry containment not to count as shape overlap');
  assert(flippedGroupLocalGeometryCorpusResult.previewExists, 'expected flipped group local geometry corpus preview to exist');
  assert(flippedGroupLocalGeometryCorpusResult.previewFresh, 'expected flipped group local geometry corpus preview to be fresh');
  assert(flippedGroupLocalGeometryCorpusResult.risks.length === 0, 'expected flipped group local geometry corpus to have no risks');

  const nestedTransformedGroupLocalGeometryCorpusResult = await analyzeVsdx(nestedTransformedGroupLocalGeometryCorpusPath, nestedTransformedGroupLocalGeometryCorpusPreviewPath, await createSinglePreviewCacheIndex(nestedTransformedGroupLocalGeometryCorpusPath, nestedTransformedGroupLocalGeometryCorpusPreviewPath), config);
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.pageCount === 1, 'expected one nested transformed group local geometry corpus page');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.shapeCount === 5, 'expected five nested transformed group local geometry corpus shapes');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.textShapeCount === 4, 'expected four nested transformed group local geometry corpus text shapes');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.unlabeledShapeCount === 0, 'expected no nested transformed group local geometry corpus unlabeled shapes');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.oneDShapeCount === 0, 'expected no nested transformed group local geometry corpus OneD shapes');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.connectCount === 2, 'expected two nested transformed group local geometry corpus connects');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no nested transformed group local geometry corpus out-of-bounds shapes');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.straightConnectorCount === 0, 'expected no straight nested transformed group local geometry corpus connector');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.orthogonalConnectorCount === 1, 'expected one orthogonal nested transformed group local geometry corpus connector');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.complexConnectorCount === 0, 'expected no complex nested transformed group local geometry corpus connector');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.diagonalConnectorCount === 0, 'expected no diagonal nested transformed group local geometry corpus connector');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.connectorCrossingCount === 0, 'expected no nested transformed group local geometry corpus connector crossing');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.danglingConnectorCount === 0, 'expected no nested transformed group local geometry corpus dangling connector');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.stats.shapeOverlapPairCount === 0, 'expected nested transformed group containment not to count as shape overlap');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.previewExists, 'expected nested transformed group local geometry corpus preview to exist');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.previewFresh, 'expected nested transformed group local geometry corpus preview to be fresh');
  assert(nestedTransformedGroupLocalGeometryCorpusResult.risks.length === 0, 'expected nested transformed group local geometry corpus to have no risks');

  const duplicateShapeIdMultipageCorpusResult = await analyzeVsdx(duplicateShapeIdMultipageCorpusPath, duplicateShapeIdMultipageCorpusPreviewPath, await createSinglePreviewCacheIndex(duplicateShapeIdMultipageCorpusPath, duplicateShapeIdMultipageCorpusPreviewPath, 2), config);
  assert(duplicateShapeIdMultipageCorpusResult.stats.pageCount === 2, 'expected two duplicate shape ID corpus pages');
  assert(duplicateShapeIdMultipageCorpusResult.stats.shapeCount === 6, 'expected six duplicate shape ID corpus shapes');
  assert(duplicateShapeIdMultipageCorpusResult.stats.textShapeCount === 4, 'expected four duplicate shape ID corpus text shapes');
  assert(duplicateShapeIdMultipageCorpusResult.stats.unlabeledShapeCount === 0, 'expected no duplicate shape ID corpus unlabeled shapes');
  assert(duplicateShapeIdMultipageCorpusResult.stats.oneDShapeCount === 2, 'expected two duplicate shape ID corpus OneD shapes');
  assert(duplicateShapeIdMultipageCorpusResult.stats.connectCount === 2, 'expected two duplicate shape ID corpus connects');
  assert(duplicateShapeIdMultipageCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no duplicate shape ID corpus out-of-bounds shapes');
  assert(duplicateShapeIdMultipageCorpusResult.stats.straightConnectorCount === 2, 'expected two straight duplicate shape ID corpus connectors');
  assert(duplicateShapeIdMultipageCorpusResult.stats.orthogonalConnectorCount === 0, 'expected no duplicate shape ID corpus orthogonal connectors');
  assert(duplicateShapeIdMultipageCorpusResult.stats.complexConnectorCount === 0, 'expected no duplicate shape ID corpus complex connectors');
  assert(duplicateShapeIdMultipageCorpusResult.stats.diagonalConnectorCount === 0, 'expected no duplicate shape ID corpus diagonal connectors');
  assert(duplicateShapeIdMultipageCorpusResult.stats.connectorCrossingCount === 0, 'expected no duplicate shape ID corpus connector crossing');
  assert(duplicateShapeIdMultipageCorpusResult.stats.danglingConnectorCount === 1, 'expected one duplicate shape ID corpus dangling connector');
  assert(duplicateShapeIdMultipageCorpusResult.stats.shapeOverlapPairCount === 0, 'expected no duplicate shape ID corpus shape overlap');
  assert(duplicateShapeIdMultipageCorpusResult.previewExists, 'expected duplicate shape ID corpus preview to exist');
  assert(duplicateShapeIdMultipageCorpusResult.previewFresh, 'expected duplicate shape ID corpus preview to be fresh');
  assert(duplicateShapeIdMultipageCorpusResult.pages[0]?.connectCount === 2, 'expected first duplicate ID page to have page-local connects');
  assert(duplicateShapeIdMultipageCorpusResult.pages[0]?.danglingConnectorCount === 0, 'expected first duplicate ID page to have no dangling connector');
  assert(duplicateShapeIdMultipageCorpusResult.pages[1]?.connectCount === 0, 'expected second duplicate ID page to have no page-local connects');
  assert(duplicateShapeIdMultipageCorpusResult.pages[1]?.danglingConnectorCount === 1, 'expected second duplicate ID page to keep its dangling connector');
  assert(duplicateShapeIdMultipageCorpusResult.risks.length === 1, 'expected duplicate shape ID corpus to have exactly one risk');
  assert(duplicateShapeIdMultipageCorpusResult.risks.some(risk => risk.code === 'DANGLING_CONNECTORS' && risk.page === 'Duplicate ID Missing Connects'), 'expected duplicate shape ID corpus dangling warning on the second page');

  const duplicateShapeIdSamePageGroupCorpusResult = await analyzeVsdx(duplicateShapeIdSamePageGroupCorpusPath, duplicateShapeIdSamePageGroupCorpusPreviewPath, await createSinglePreviewCacheIndex(duplicateShapeIdSamePageGroupCorpusPath, duplicateShapeIdSamePageGroupCorpusPreviewPath), config);
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.pageCount === 1, 'expected one same-page duplicate ID corpus page');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.shapeCount === 5, 'expected five same-page duplicate ID corpus shapes');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.textShapeCount === 4, 'expected four same-page duplicate ID corpus text shapes');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.unlabeledShapeCount === 0, 'expected no same-page duplicate ID corpus unlabeled shapes');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.oneDShapeCount === 1, 'expected one same-page duplicate ID corpus OneD shape');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.connectCount === 2, 'expected two same-page duplicate ID corpus connects');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.duplicateShapeIdCount === 1, 'expected one same-page duplicate ID occurrence');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no same-page duplicate ID corpus out-of-bounds shapes');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.straightConnectorCount === 1, 'expected one same-page duplicate ID corpus straight connector');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.orthogonalConnectorCount === 0, 'expected no same-page duplicate ID corpus orthogonal connectors');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.complexConnectorCount === 0, 'expected no same-page duplicate ID corpus complex connectors');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.diagonalConnectorCount === 0, 'expected no same-page duplicate ID corpus diagonal connectors');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.connectorCrossingCount === 1, 'expected ambiguous duplicate endpoint ID not to suppress connector crossing evidence');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.danglingConnectorCount === 0, 'expected same-page duplicate ID corpus connector to keep its unique endpoint evidence');
  assert(duplicateShapeIdSamePageGroupCorpusResult.stats.shapeOverlapPairCount === 0, 'expected no same-page duplicate ID corpus shape overlap');
  assert(duplicateShapeIdSamePageGroupCorpusResult.previewExists, 'expected same-page duplicate ID corpus preview to exist');
  assert(duplicateShapeIdSamePageGroupCorpusResult.previewFresh, 'expected same-page duplicate ID corpus preview to be fresh');
  assert(duplicateShapeIdSamePageGroupCorpusResult.risks.length === 2, 'expected same-page duplicate ID corpus to have duplicate ID and crossing risks');
  assert(duplicateShapeIdSamePageGroupCorpusResult.risks.some(risk => risk.code === 'DUPLICATE_SHAPE_IDS' && risk.page === 'Duplicate ID Same Page Group Corpus'), 'expected same-page duplicate Shape ID warning');
  assert(duplicateShapeIdSamePageGroupCorpusResult.risks.some(risk => risk.code === 'CONNECTOR_CROSSES_SHAPE' && risk.page === 'Duplicate ID Same Page Group Corpus'), 'expected same-page duplicate Shape ID crossing warning');

  const duplicateConnectorIdSamePageCorpusResult = await analyzeVsdx(duplicateConnectorIdSamePageCorpusPath, duplicateConnectorIdSamePageCorpusPreviewPath, await createSinglePreviewCacheIndex(duplicateConnectorIdSamePageCorpusPath, duplicateConnectorIdSamePageCorpusPreviewPath), config);
  assert(duplicateConnectorIdSamePageCorpusResult.stats.pageCount === 1, 'expected one duplicate connector ID corpus page');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.shapeCount === 4, 'expected four duplicate connector ID corpus shapes');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.textShapeCount === 2, 'expected two duplicate connector ID corpus text shapes');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.unlabeledShapeCount === 0, 'expected no duplicate connector ID corpus unlabeled shapes');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.oneDShapeCount === 2, 'expected two duplicate connector ID corpus OneD shapes');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.connectCount === 2, 'expected two raw duplicate connector ID corpus connects');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.duplicateShapeIdCount === 1, 'expected one duplicate connector ID occurrence');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no duplicate connector ID corpus out-of-bounds shapes');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.straightConnectorCount === 2, 'expected two duplicate connector ID corpus straight connectors');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.orthogonalConnectorCount === 0, 'expected no duplicate connector ID corpus orthogonal connectors');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.complexConnectorCount === 0, 'expected no duplicate connector ID corpus complex connectors');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.diagonalConnectorCount === 0, 'expected no duplicate connector ID corpus diagonal connectors');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.connectorCrossingCount === 0, 'expected no duplicate connector ID corpus connector crossing');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.danglingConnectorCount === 2, 'expected duplicate connector ID FromSheet evidence to be downgraded for both connectors');
  assert(duplicateConnectorIdSamePageCorpusResult.stats.shapeOverlapPairCount === 0, 'expected no duplicate connector ID corpus shape overlap');
  assert(duplicateConnectorIdSamePageCorpusResult.previewExists, 'expected duplicate connector ID corpus preview to exist');
  assert(duplicateConnectorIdSamePageCorpusResult.previewFresh, 'expected duplicate connector ID corpus preview to be fresh');
  assert(duplicateConnectorIdSamePageCorpusResult.risks.length === 2, 'expected duplicate connector ID corpus to have duplicate ID and dangling risks');
  assert(duplicateConnectorIdSamePageCorpusResult.risks.some(risk => risk.code === 'DUPLICATE_SHAPE_IDS' && risk.page === 'Duplicate Connector ID Same Page Corpus'), 'expected duplicate connector Shape ID warning');
  assert(duplicateConnectorIdSamePageCorpusResult.risks.some(risk => risk.code === 'DANGLING_CONNECTORS' && risk.page === 'Duplicate Connector ID Same Page Corpus'), 'expected duplicate connector dangling warning');

  const invalidConnectsMultipageCorpusResult = await analyzeVsdx(invalidConnectsMultipageCorpusPath, invalidConnectsMultipageCorpusPreviewPath, await createSinglePreviewCacheIndex(invalidConnectsMultipageCorpusPath, invalidConnectsMultipageCorpusPreviewPath, 2), config);
  assert(invalidConnectsMultipageCorpusResult.stats.pageCount === 2, 'expected two invalid connects corpus pages');
  assert(invalidConnectsMultipageCorpusResult.stats.shapeCount === 7, 'expected seven invalid connects corpus shapes');
  assert(invalidConnectsMultipageCorpusResult.stats.textShapeCount === 5, 'expected five invalid connects corpus text shapes');
  assert(invalidConnectsMultipageCorpusResult.stats.unlabeledShapeCount === 0, 'expected no invalid connects corpus unlabeled shapes');
  assert(invalidConnectsMultipageCorpusResult.stats.oneDShapeCount === 2, 'expected two invalid connects corpus OneD shapes');
  assert(invalidConnectsMultipageCorpusResult.stats.connectCount === 4, 'expected four raw invalid connects corpus connects');
  assert(invalidConnectsMultipageCorpusResult.stats.outOfBoundsShapeCount === 0, 'expected no invalid connects corpus out-of-bounds shapes');
  assert(invalidConnectsMultipageCorpusResult.stats.straightConnectorCount === 2, 'expected two straight invalid connects corpus connectors');
  assert(invalidConnectsMultipageCorpusResult.stats.orthogonalConnectorCount === 0, 'expected no invalid connects corpus orthogonal connectors');
  assert(invalidConnectsMultipageCorpusResult.stats.complexConnectorCount === 0, 'expected no invalid connects corpus complex connectors');
  assert(invalidConnectsMultipageCorpusResult.stats.diagonalConnectorCount === 0, 'expected no invalid connects corpus diagonal connectors');
  assert(invalidConnectsMultipageCorpusResult.stats.connectorCrossingCount === 0, 'expected no invalid connects corpus connector crossing');
  assert(invalidConnectsMultipageCorpusResult.stats.danglingConnectorCount === 1, 'expected one invalid connects corpus dangling connector');
  assert(invalidConnectsMultipageCorpusResult.stats.shapeOverlapPairCount === 0, 'expected no invalid connects corpus shape overlap');
  assert(invalidConnectsMultipageCorpusResult.previewExists, 'expected invalid connects corpus preview to exist');
  assert(invalidConnectsMultipageCorpusResult.previewFresh, 'expected invalid connects corpus preview to be fresh');
  assert(invalidConnectsMultipageCorpusResult.pages[0]?.connectCount === 2, 'expected first invalid connects page to keep valid connects');
  assert(invalidConnectsMultipageCorpusResult.pages[0]?.danglingConnectorCount === 0, 'expected first invalid connects page to have no dangling connector');
  assert(invalidConnectsMultipageCorpusResult.pages[1]?.connectCount === 2, 'expected second invalid connects page to retain raw invalid connect count');
  assert(invalidConnectsMultipageCorpusResult.pages[1]?.danglingConnectorCount === 1, 'expected invalid and cross-page references not to satisfy dangling evidence');
  assert(invalidConnectsMultipageCorpusResult.risks.length === 1, 'expected invalid connects corpus to have exactly one risk');
  assert(invalidConnectsMultipageCorpusResult.risks.some(risk => risk.code === 'DANGLING_CONNECTORS' && risk.page === 'Invalid Connects Missing Local Targets'), 'expected invalid connects corpus dangling warning on invalid target page');

  console.log(JSON.stringify({
    ok: true,
    fixturePath,
    previewPath,
    stats: result.stats,
    risks: result.risks,
    routeCorpus: {
      fixturePath: routeCorpusPath,
      previewPath: routeCorpusPreviewPath,
      stats: routeCorpusResult.stats,
      risks: routeCorpusResult.risks
    },
    businessCorpus: {
      fixturePath: businessCorpusPath,
      previewPath: businessCorpusPreviewPath,
      stats: businessCorpusResult.stats,
      risks: businessCorpusResult.risks
    },
    localGeometryCorpus: {
      fixturePath: localGeometryCorpusPath,
      previewPath: localGeometryCorpusPreviewPath,
      stats: localGeometryCorpusResult.stats,
      risks: localGeometryCorpusResult.risks
    },
    transformedLocalGeometryCorpus: {
      fixturePath: transformedLocalGeometryCorpusPath,
      previewPath: transformedLocalGeometryCorpusPreviewPath,
      stats: transformedLocalGeometryCorpusResult.stats,
      risks: transformedLocalGeometryCorpusResult.risks
    },
    containerCorpus: {
      fixturePath: containerCorpusPath,
      previewPath: containerCorpusPreviewPath,
      stats: containerCorpusResult.stats,
      risks: containerCorpusResult.risks
    },
    endpointConnectorCorpus: {
      fixturePath: endpointConnectorCorpusPath,
      previewPath: endpointConnectorCorpusPreviewPath,
      stats: endpointConnectorCorpusResult.stats,
      risks: endpointConnectorCorpusResult.risks
    },
    groupNestedCorpus: {
      fixturePath: groupNestedCorpusPath,
      previewPath: groupNestedCorpusPreviewPath,
      stats: groupNestedCorpusResult.stats,
      risks: groupNestedCorpusResult.risks
    },
    groupParentChildConnectsCorpus: {
      fixturePath: groupParentChildConnectsCorpusPath,
      previewPath: groupParentChildConnectsCorpusPreviewPath,
      stats: groupParentChildConnectsCorpusResult.stats,
      risks: groupParentChildConnectsCorpusResult.risks
    },
    groupLocalGeometryCorpus: {
      fixturePath: groupLocalGeometryCorpusPath,
      previewPath: groupLocalGeometryCorpusPreviewPath,
      stats: groupLocalGeometryCorpusResult.stats,
      risks: groupLocalGeometryCorpusResult.risks
    },
    rotatedGroupLocalGeometryCorpus: {
      fixturePath: rotatedGroupLocalGeometryCorpusPath,
      previewPath: rotatedGroupLocalGeometryCorpusPreviewPath,
      stats: rotatedGroupLocalGeometryCorpusResult.stats,
      risks: rotatedGroupLocalGeometryCorpusResult.risks
    },
    flippedGroupLocalGeometryCorpus: {
      fixturePath: flippedGroupLocalGeometryCorpusPath,
      previewPath: flippedGroupLocalGeometryCorpusPreviewPath,
      stats: flippedGroupLocalGeometryCorpusResult.stats,
      risks: flippedGroupLocalGeometryCorpusResult.risks
    },
    nestedTransformedGroupLocalGeometryCorpus: {
      fixturePath: nestedTransformedGroupLocalGeometryCorpusPath,
      previewPath: nestedTransformedGroupLocalGeometryCorpusPreviewPath,
      stats: nestedTransformedGroupLocalGeometryCorpusResult.stats,
      risks: nestedTransformedGroupLocalGeometryCorpusResult.risks
    },
    duplicateShapeIdMultipageCorpus: {
      fixturePath: duplicateShapeIdMultipageCorpusPath,
      previewPath: duplicateShapeIdMultipageCorpusPreviewPath,
      stats: duplicateShapeIdMultipageCorpusResult.stats,
      pages: duplicateShapeIdMultipageCorpusResult.pages,
      risks: duplicateShapeIdMultipageCorpusResult.risks
    },
    duplicateShapeIdSamePageGroupCorpus: {
      fixturePath: duplicateShapeIdSamePageGroupCorpusPath,
      previewPath: duplicateShapeIdSamePageGroupCorpusPreviewPath,
      stats: duplicateShapeIdSamePageGroupCorpusResult.stats,
      pages: duplicateShapeIdSamePageGroupCorpusResult.pages,
      risks: duplicateShapeIdSamePageGroupCorpusResult.risks
    },
    duplicateConnectorIdSamePageCorpus: {
      fixturePath: duplicateConnectorIdSamePageCorpusPath,
      previewPath: duplicateConnectorIdSamePageCorpusPreviewPath,
      stats: duplicateConnectorIdSamePageCorpusResult.stats,
      pages: duplicateConnectorIdSamePageCorpusResult.pages,
      risks: duplicateConnectorIdSamePageCorpusResult.risks
    },
    invalidConnectsMultipageCorpus: {
      fixturePath: invalidConnectsMultipageCorpusPath,
      previewPath: invalidConnectsMultipageCorpusPreviewPath,
      stats: invalidConnectsMultipageCorpusResult.stats,
      pages: invalidConnectsMultipageCorpusResult.pages,
      risks: invalidConnectsMultipageCorpusResult.risks
    }
  }, null, 2));
}

async function createSinglePreviewCacheIndex(sourcePath: string, previewPath: string, exportedPageCount = 1): Promise<CacheIndex> {
  const [sourceStat, previewStat, sourceHash] = await Promise.all([
    fs.stat(sourcePath),
    fs.stat(previewPath),
    hashFile(sourcePath)
  ]);

  return {
    version: 1,
    records: {
      [sourcePath]: {
        sourcePath,
        sourceMtimeMs: sourceStat.mtimeMs,
        sourceSize: sourceStat.size,
        sourceHash,
        previewPath,
        previewPaths: [previewPath],
        previewMtimeMs: previewStat.mtimeMs,
        previewSize: previewStat.size,
        format: 'png',
        exportedPageCount,
        updatedAt: new Date().toISOString()
      }
    }
  };
}

function createSolidRgbPng(red: number, green: number, blue: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(Buffer.from([0, red, green, blue]));
  return Buffer.concat([
    signature,
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', idat),
    createPngChunk('IEND', Buffer.alloc(0))
  ]);
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(8 + data.length + 4);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function writeMinimalVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page2.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Page-1" Name="Main">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="8"/>',
    '      <Cell N="PageHeight" V="10"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '  <Page ID="1" NameU="Page-2" Name="Risk">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="2"/>',
    '      <Cell N="PageHeight" V="2"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId2"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Process" Type="Shape"><Cell N="PinX" V="2"/><Cell N="PinY" V="2"/><Cell N="Width" V="2"/><Cell N="Height" V="1"/><Text>Process</Text></Shape>',
    '    <Shape ID="2" NameU="Connector" Type="Shape" OneD="1"><Cell N="BeginX" V="0"/><Cell N="BeginY" V="0"/><Cell N="EndX" V="4"/><Cell N="EndY" V="4"/></Shape>',
    '    <Shape ID="4" NameU="Obstacle" Type="Shape"><Cell N="PinX" V="3.1"/><Cell N="PinY" V="3.2"/><Cell N="Width" V="0.8"/><Cell N="Height" V="0.8"/><Text>Obstacle</Text></Shape>',
    '    <Shape ID="5" NameU="OverlapA" Type="Shape"><Cell N="PinX" V="6"/><Cell N="PinY" V="8"/><Cell N="Width" V="1.2"/><Cell N="Height" V="1.2"/><Text>Overlap A</Text></Shape>',
    '    <Shape ID="6" NameU="OverlapB" Type="Shape"><Cell N="PinX" V="6.4"/><Cell N="PinY" V="8"/><Cell N="Width" V="1.2"/><Cell N="Height" V="1.2"/><Text>Overlap B</Text></Shape>',
    '    <Shape ID="7" NameU="Dynamic connector" Type="Shape" OneD="1">',
    '      <Cell N="BeginX" V="1"/><Cell N="BeginY" V="5"/><Cell N="EndX" V="4"/><Cell N="EndY" V="6"/>',
    '      <Section N="Geometry"><Row T="LineTo"><Cell N="X" V="1"/><Cell N="Y" V="6"/></Row><Row T="LineTo"><Cell N="X" V="4"/><Cell N="Y" V="6"/></Row></Section>',
    '    </Shape>',
    '    <Shape ID="8" NameU="Loose connector" Type="Shape" OneD="1"><Cell N="BeginX" V="0"/><Cell N="BeginY" V="9"/><Cell N="EndX" V="2"/><Cell N="EndY" V="9"/></Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="2" ToSheet="1"/>',
    '    <Connect FromSheet="7" ToSheet="4"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));
  zip.file('visio/pages/page2.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="3" NameU="OutOfBounds" Type="Shape"><Cell N="PinX" V="3"/><Cell N="PinY" V="1"/><Cell N="Width" V="2"/><Cell N="Height" V="1"/></Shape>',
    '  </Shapes>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeConnectorRouteCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Route-Corpus" Name="Route Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="7"/>',
    '      <Cell N="PageHeight" V="6"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Source" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="1"/><Cell N="Width" V="0.8"/><Cell N="Height" V="0.8"/><Text>Source</Text></Shape>',
    '    <Shape ID="2" NameU="Target" Type="Shape"><Cell N="PinX" V="5"/><Cell N="PinY" V="3"/><Cell N="Width" V="0.8"/><Cell N="Height" V="0.8"/><Text>Target</Text></Shape>',
    '    <Shape ID="3" NameU="Dynamic connector" Type="Shape" OneD="1">',
    '      <Cell N="BeginX" V="1"/><Cell N="BeginY" V="1"/><Cell N="EndX" V="5"/><Cell N="EndY" V="3"/>',
    '      <Section N="Geometry">',
    '        <Row T="LineTo"><Cell N="X" V="1"/><Cell N="Y" V="2"/></Row>',
    '        <Row T="LineTo"><Cell N="X" V="3"/><Cell N="Y" V="2"/></Row>',
    '        <Row T="LineTo"><Cell N="X" V="3"/><Cell N="Y" V="4"/></Row>',
    '        <Row T="LineTo"><Cell N="X" V="5"/><Cell N="Y" V="4"/></Row>',
    '        <Row T="LineTo"><Cell N="X" V="5"/><Cell N="Y" V="3"/></Row>',
    '      </Section>',
    '    </Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="3" ToSheet="1"/>',
    '    <Connect FromSheet="3" ToSheet="2"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeBusinessProcessCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Business-Process-Corpus" Name="Business Process Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="8"/>',
    '      <Cell N="PageHeight" V="6"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Process" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="3"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Intake</Text></Shape>',
    '    <Shape ID="2" NameU="Process" Type="Shape"><Cell N="PinX" V="2.8"/><Cell N="PinY" V="3"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Review</Text></Shape>',
    '    <Shape ID="3" NameU="Process" Type="Shape"><Cell N="PinX" V="4.6"/><Cell N="PinY" V="3"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Approval</Text></Shape>',
    '    <Shape ID="4" NameU="Process" Type="Shape"><Cell N="PinX" V="6.4"/><Cell N="PinY" V="3"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Delivery</Text></Shape>',
    '    <Shape ID="5" NameU="LaneLabel" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="5"/><Cell N="Width" V="1.3"/><Cell N="Height" V="0.4"/><Text>Operations</Text></Shape>',
    '    <Shape ID="6" NameU="LaneLabel" Type="Shape"><Cell N="PinX" V="4.6"/><Cell N="PinY" V="5"/><Cell N="Width" V="1.3"/><Cell N="Height" V="0.4"/><Text>Governance</Text></Shape>',
    '    <Shape ID="7" NameU="Dynamic connector" Type="Shape" OneD="1"><Cell N="BeginX" V="1"/><Cell N="BeginY" V="3"/><Cell N="EndX" V="2.8"/><Cell N="EndY" V="3"/></Shape>',
    '    <Shape ID="8" NameU="Dynamic connector" Type="Shape" OneD="1"><Cell N="BeginX" V="2.8"/><Cell N="BeginY" V="3"/><Cell N="EndX" V="4.6"/><Cell N="EndY" V="3"/></Shape>',
    '    <Shape ID="9" NameU="Dynamic connector" Type="Shape" OneD="1"><Cell N="BeginX" V="4.6"/><Cell N="BeginY" V="3"/><Cell N="EndX" V="6.4"/><Cell N="EndY" V="3"/></Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="7" ToSheet="1"/>',
    '    <Connect FromSheet="7" ToSheet="2"/>',
    '    <Connect FromSheet="8" ToSheet="2"/>',
    '    <Connect FromSheet="8" ToSheet="3"/>',
    '    <Connect FromSheet="9" ToSheet="3"/>',
    '    <Connect FromSheet="9" ToSheet="4"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeLocalGeometryRouteCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Local-Geometry-Route-Corpus" Name="Local Geometry Route Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="7"/>',
    '      <Cell N="PageHeight" V="6"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Source" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="1"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Source</Text></Shape>',
    '    <Shape ID="2" NameU="Target" Type="Shape"><Cell N="PinX" V="5"/><Cell N="PinY" V="3"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Target</Text></Shape>',
    '    <Shape ID="3" Type="Shape" Master="2">',
    '      <Cell N="PinX" V="3"/><Cell N="PinY" V="2"/><Cell N="Width" V="4"/><Cell N="Height" V="2"/>',
    '      <Cell N="LocPinX" V="2"/><Cell N="LocPinY" V="1"/>',
    '      <Cell N="BeginX" V="1"/><Cell N="BeginY" V="1"/><Cell N="EndX" V="5"/><Cell N="EndY" V="3"/>',
    '      <Section N="Geometry">',
    '        <Row T="MoveTo"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>',
    '        <Row T="LineTo"><Cell N="X" V="0"/><Cell N="Y" V="2"/></Row>',
    '        <Row T="LineTo"><Cell N="X" V="4"/><Cell N="Y" V="2"/></Row>',
    '      </Section>',
    '    </Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="3" ToSheet="1"/>',
    '    <Connect FromSheet="3" ToSheet="2"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeTransformedLocalGeometryRouteCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Transformed-Local-Geometry-Route-Corpus" Name="Transformed Local Geometry Route Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="9"/>',
    '      <Cell N="PageHeight" V="6"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Source" Type="Shape"><Cell N="PinX" V="4"/><Cell N="PinY" V="1"/><Cell N="Width" V="1"/><Cell N="Height" V="0.7"/><Text>Rotated Start</Text></Shape>',
    '    <Shape ID="2" NameU="Target" Type="Shape"><Cell N="PinX" V="2"/><Cell N="PinY" V="5"/><Cell N="Width" V="1"/><Cell N="Height" V="0.7"/><Text>Rotated End</Text></Shape>',
    '    <Shape ID="3" Type="Shape" Master="2">',
    '      <Cell N="PinX" V="3"/><Cell N="PinY" V="3"/><Cell N="Width" V="4"/><Cell N="Height" V="2"/>',
    '      <Cell N="LocPinX" V="2"/><Cell N="LocPinY" V="1"/><Cell N="Angle" V="1.5707963267948966"/>',
    '      <Cell N="BeginX" V="4"/><Cell N="BeginY" V="1"/><Cell N="EndX" V="2"/><Cell N="EndY" V="5"/>',
    '      <Section N="Geometry">',
    '        <Row T="MoveTo"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>',
    '        <Row T="LineTo"><Cell N="X" V="0"/><Cell N="Y" V="2"/></Row>',
    '        <Row T="LineTo"><Cell N="X" V="4"/><Cell N="Y" V="2"/></Row>',
    '      </Section>',
    '    </Shape>',
    '    <Shape ID="4" NameU="Source" Type="Shape"><Cell N="PinX" V="8"/><Cell N="PinY" V="2"/><Cell N="Width" V="1"/><Cell N="Height" V="0.7"/><Text>Flipped Start</Text></Shape>',
    '    <Shape ID="5" NameU="Target" Type="Shape"><Cell N="PinX" V="4"/><Cell N="PinY" V="4"/><Cell N="Width" V="1"/><Cell N="Height" V="0.7"/><Text>Flipped End</Text></Shape>',
    '    <Shape ID="6" Type="Shape" Master="2">',
    '      <Cell N="PinX" V="6"/><Cell N="PinY" V="3"/><Cell N="Width" V="4"/><Cell N="Height" V="2"/>',
    '      <Cell N="LocPinX" V="2"/><Cell N="LocPinY" V="1"/><Cell N="FlipX" V="1"/>',
    '      <Cell N="BeginX" V="8"/><Cell N="BeginY" V="2"/><Cell N="EndX" V="4"/><Cell N="EndY" V="4"/>',
    '      <Section N="Geometry">',
    '        <Row T="MoveTo"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>',
    '        <Row T="LineTo"><Cell N="X" V="0"/><Cell N="Y" V="2"/></Row>',
    '        <Row T="LineTo"><Cell N="X" V="4"/><Cell N="Y" V="2"/></Row>',
    '      </Section>',
    '    </Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="3" ToSheet="1"/>',
    '    <Connect FromSheet="3" ToSheet="2"/>',
    '    <Connect FromSheet="6" ToSheet="4"/>',
    '    <Connect FromSheet="6" ToSheet="5"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeContainerBoundaryCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Container-Boundary-Corpus" Name="Container Boundary Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="8"/>',
    '      <Cell N="PageHeight" V="6"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Container" Type="Shape"><Cell N="PinX" V="4"/><Cell N="PinY" V="3"/><Cell N="Width" V="6"/><Cell N="Height" V="4"/><Text>Phase Boundary</Text></Shape>',
    '    <Shape ID="2" NameU="Process" Type="Shape"><Cell N="PinX" V="2.5"/><Cell N="PinY" V="3"/><Cell N="Width" V="1"/><Cell N="Height" V="0.8"/><Text>Intake</Text></Shape>',
    '    <Shape ID="3" NameU="Process" Type="Shape"><Cell N="PinX" V="5.5"/><Cell N="PinY" V="3"/><Cell N="Width" V="1"/><Cell N="Height" V="0.8"/><Text>Review</Text></Shape>',
    '    <Shape ID="4" NameU="Dynamic connector" Type="Shape" OneD="1"><Cell N="BeginX" V="2.5"/><Cell N="BeginY" V="3"/><Cell N="EndX" V="5.5"/><Cell N="EndY" V="3"/></Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="4" ToSheet="2"/>',
    '    <Connect FromSheet="4" ToSheet="3"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeEndpointConnectorEvidenceCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Endpoint-Connector-Evidence-Corpus" Name="Endpoint Connector Evidence Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="8"/>',
    '      <Cell N="PageHeight" V="6"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Process" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="4"/><Cell N="Width" V="1"/><Cell N="Height" V="0.7"/><Text>Step A</Text></Shape>',
    '    <Shape ID="2" NameU="Process" Type="Shape"><Cell N="PinX" V="2.5"/><Cell N="PinY" V="4"/><Cell N="Width" V="1"/><Cell N="Height" V="0.7"/><Text>Step B</Text></Shape>',
    '    <Shape ID="3" NameU="Process" Type="Shape"><Cell N="PinX" V="4"/><Cell N="PinY" V="4"/><Cell N="Width" V="1"/><Cell N="Height" V="0.7"/><Text>Step C</Text></Shape>',
    '    <Shape ID="4" NameU="Process" Type="Shape"><Cell N="PinX" V="5.5"/><Cell N="PinY" V="4"/><Cell N="Width" V="1"/><Cell N="Height" V="0.7"/><Text>Step D</Text></Shape>',
    '    <Shape ID="5" NameU="Process" Type="Shape"><Cell N="PinX" V="7"/><Cell N="PinY" V="4"/><Cell N="Width" V="1"/><Cell N="Height" V="0.7"/><Text>Step E</Text></Shape>',
    '    <Shape ID="6" Type="Shape"><Cell N="BeginX" V="1"/><Cell N="BeginY" V="4"/><Cell N="EndX" V="2.5"/><Cell N="EndY" V="4"/></Shape>',
    '  </Shapes>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeGroupNestedCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Group-Nested-Corpus" Name="Group Nested Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="8"/>',
    '      <Cell N="PageHeight" V="6"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Group" Type="Group">',
    '      <Cell N="PinX" V="4"/><Cell N="PinY" V="3"/><Cell N="Width" V="6"/><Cell N="Height" V="4"/>',
    '      <Cell N="LocPinX" V="3"/><Cell N="LocPinY" V="2"/><Text>Grouped Flow</Text>',
    '      <Shapes>',
    '        <Shape ID="2" NameU="Process" Type="Shape"><Cell N="PinX" V="2"/><Cell N="PinY" V="2"/><Cell N="Width" V="1"/><Cell N="Height" V="0.8"/><Text>Child A</Text></Shape>',
    '        <Shape ID="3" NameU="Process" Type="Shape"><Cell N="PinX" V="4"/><Cell N="PinY" V="2"/><Cell N="Width" V="1"/><Cell N="Height" V="0.8"/><Text>Child B</Text></Shape>',
    '        <Shape ID="4" Type="Shape"><Cell N="BeginX" V="2"/><Cell N="BeginY" V="2"/><Cell N="EndX" V="4"/><Cell N="EndY" V="2"/></Shape>',
    '      </Shapes>',
    '    </Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="4" ToSheet="2"/>',
    '    <Connect FromSheet="4" ToSheet="3"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeGroupParentChildConnectsCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Group-Parent-Child-Connects-Corpus" Name="Group Parent Child Connects Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="8"/>',
    '      <Cell N="PageHeight" V="5"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Group" Type="Group">',
    '      <Cell N="PinX" V="4"/><Cell N="PinY" V="2.5"/><Cell N="Width" V="5"/><Cell N="Height" V="3"/>',
    '      <Cell N="LocPinX" V="2.5"/><Cell N="LocPinY" V="1.5"/><Text>Parent Boundary</Text>',
    '      <Shapes>',
    '        <Shape ID="2" NameU="Process" Type="Shape"><Cell N="PinX" V="3.5"/><Cell N="PinY" V="1.5"/><Cell N="Width" V="1"/><Cell N="Height" V="0.7"/><Text>Child Target</Text></Shape>',
    '        <Shape ID="3" Type="Shape"><Cell N="BeginX" V="1.5"/><Cell N="BeginY" V="1.5"/><Cell N="EndX" V="3.5"/><Cell N="EndY" V="1.5"/></Shape>',
    '      </Shapes>',
    '    </Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="3" ToSheet="1"/>',
    '    <Connect FromSheet="3" ToSheet="2"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeGroupLocalGeometryRouteCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Group-Local-Geometry-Route-Corpus" Name="Group Local Geometry Route Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="8"/>',
    '      <Cell N="PageHeight" V="6"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Group" Type="Group">',
    '      <Cell N="PinX" V="4"/><Cell N="PinY" V="3"/><Cell N="Width" V="6"/><Cell N="Height" V="4"/>',
    '      <Cell N="LocPinX" V="3"/><Cell N="LocPinY" V="2"/><Text>Grouped Routed Flow</Text>',
    '      <Shapes>',
    '        <Shape ID="2" NameU="Process" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="1"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Intake</Text></Shape>',
    '        <Shape ID="3" NameU="Process" Type="Shape"><Cell N="PinX" V="5"/><Cell N="PinY" V="3"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Approve</Text></Shape>',
    '        <Shape ID="4" Type="Shape" Master="2">',
    '          <Cell N="PinX" V="3"/><Cell N="PinY" V="2"/><Cell N="Width" V="4"/><Cell N="Height" V="2"/>',
    '          <Cell N="LocPinX" V="2"/><Cell N="LocPinY" V="1"/>',
    '          <Cell N="BeginX" V="1"/><Cell N="BeginY" V="1"/><Cell N="EndX" V="5"/><Cell N="EndY" V="3"/>',
    '          <Section N="Geometry">',
    '            <Row T="MoveTo"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>',
    '            <Row T="LineTo"><Cell N="X" V="0"/><Cell N="Y" V="2"/></Row>',
    '            <Row T="LineTo"><Cell N="X" V="4"/><Cell N="Y" V="2"/></Row>',
    '          </Section>',
    '        </Shape>',
    '      </Shapes>',
    '    </Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="4" ToSheet="2"/>',
    '    <Connect FromSheet="4" ToSheet="3"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeRotatedGroupLocalGeometryRouteCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Rotated-Group-Local-Geometry-Route-Corpus" Name="Rotated Group Local Geometry Route Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="8"/>',
    '      <Cell N="PageHeight" V="6"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Group" Type="Group">',
    '      <Cell N="PinX" V="4"/><Cell N="PinY" V="3"/><Cell N="Width" V="4"/><Cell N="Height" V="6"/>',
    '      <Cell N="LocPinX" V="2"/><Cell N="LocPinY" V="3"/><Cell N="Angle" V="1.5707963267948966"/><Text>Rotated Group Flow</Text>',
    '      <Shapes>',
    '        <Shape ID="2" NameU="Process" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="1"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Start</Text></Shape>',
    '        <Shape ID="3" NameU="Process" Type="Shape"><Cell N="PinX" V="3"/><Cell N="PinY" V="5"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Finish</Text></Shape>',
    '        <Shape ID="4" Type="Shape" Master="2">',
    '          <Cell N="PinX" V="2"/><Cell N="PinY" V="3"/><Cell N="Width" V="2"/><Cell N="Height" V="4"/>',
    '          <Cell N="LocPinX" V="1"/><Cell N="LocPinY" V="2"/>',
    '          <Cell N="BeginX" V="1"/><Cell N="BeginY" V="1"/><Cell N="EndX" V="3"/><Cell N="EndY" V="5"/>',
    '          <Section N="Geometry">',
    '            <Row T="MoveTo"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>',
    '            <Row T="LineTo"><Cell N="X" V="0"/><Cell N="Y" V="4"/></Row>',
    '            <Row T="LineTo"><Cell N="X" V="2"/><Cell N="Y" V="4"/></Row>',
    '          </Section>',
    '        </Shape>',
    '      </Shapes>',
    '    </Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="4" ToSheet="2"/>',
    '    <Connect FromSheet="4" ToSheet="3"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeFlippedGroupLocalGeometryRouteCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Flipped-Group-Local-Geometry-Route-Corpus" Name="Flipped Group Local Geometry Route Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="8"/>',
    '      <Cell N="PageHeight" V="6"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Group" Type="Group">',
    '      <Cell N="PinX" V="4"/><Cell N="PinY" V="3"/><Cell N="Width" V="6"/><Cell N="Height" V="4"/>',
    '      <Cell N="LocPinX" V="3"/><Cell N="LocPinY" V="2"/><Cell N="FlipX" V="1"/><Text>Flipped Routed Flow</Text>',
    '      <Shapes>',
    '        <Shape ID="2" NameU="Process" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="1"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Start</Text></Shape>',
    '        <Shape ID="3" NameU="Process" Type="Shape"><Cell N="PinX" V="5"/><Cell N="PinY" V="3"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Finish</Text></Shape>',
    '        <Shape ID="4" Type="Shape" Master="2">',
    '          <Cell N="PinX" V="3"/><Cell N="PinY" V="2"/><Cell N="Width" V="4"/><Cell N="Height" V="2"/>',
    '          <Cell N="LocPinX" V="2"/><Cell N="LocPinY" V="1"/>',
    '          <Cell N="BeginX" V="1"/><Cell N="BeginY" V="1"/><Cell N="EndX" V="5"/><Cell N="EndY" V="3"/>',
    '          <Section N="Geometry">',
    '            <Row T="MoveTo"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>',
    '            <Row T="LineTo"><Cell N="X" V="0"/><Cell N="Y" V="2"/></Row>',
    '            <Row T="LineTo"><Cell N="X" V="4"/><Cell N="Y" V="2"/></Row>',
    '          </Section>',
    '        </Shape>',
    '      </Shapes>',
    '    </Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="4" ToSheet="2"/>',
    '    <Connect FromSheet="4" ToSheet="3"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeNestedTransformedGroupLocalGeometryRouteCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Nested-Transformed-Group-Local-Geometry-Route-Corpus" Name="Nested Transformed Group Local Geometry Route Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="9"/>',
    '      <Cell N="PageHeight" V="7"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="OuterGroup" Type="Group">',
    '      <Cell N="PinX" V="4"/><Cell N="PinY" V="3"/><Cell N="Width" V="4"/><Cell N="Height" V="6"/>',
    '      <Cell N="LocPinX" V="2"/><Cell N="LocPinY" V="3"/><Cell N="Angle" V="1.5707963267948966"/><Text>Outer Rotated Flow</Text>',
    '      <Shapes>',
    '        <Shape ID="2" NameU="InnerGroup" Type="Group">',
    '          <Cell N="PinX" V="2"/><Cell N="PinY" V="3"/><Cell N="Width" V="4"/><Cell N="Height" V="4"/>',
    '          <Cell N="LocPinX" V="2"/><Cell N="LocPinY" V="2"/><Cell N="FlipX" V="1"/><Text>Inner Flipped Flow</Text>',
    '          <Shapes>',
    '            <Shape ID="3" NameU="Process" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="1"/><Cell N="Width" V="0.9"/><Cell N="Height" V="0.7"/><Text>Start</Text></Shape>',
    '            <Shape ID="4" NameU="Process" Type="Shape"><Cell N="PinX" V="3"/><Cell N="PinY" V="3"/><Cell N="Width" V="0.9"/><Cell N="Height" V="0.7"/><Text>Finish</Text></Shape>',
    '            <Shape ID="5" Type="Shape" Master="2">',
    '              <Cell N="PinX" V="2"/><Cell N="PinY" V="2"/><Cell N="Width" V="2"/><Cell N="Height" V="2"/>',
    '              <Cell N="LocPinX" V="1"/><Cell N="LocPinY" V="1"/>',
    '              <Cell N="BeginX" V="1"/><Cell N="BeginY" V="1"/><Cell N="EndX" V="3"/><Cell N="EndY" V="3"/>',
    '              <Section N="Geometry">',
    '                <Row T="MoveTo"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>',
    '                <Row T="LineTo"><Cell N="X" V="0"/><Cell N="Y" V="2"/></Row>',
    '                <Row T="LineTo"><Cell N="X" V="2"/><Cell N="Y" V="2"/></Row>',
    '              </Section>',
    '            </Shape>',
    '          </Shapes>',
    '        </Shape>',
    '      </Shapes>',
    '    </Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="5" ToSheet="3"/>',
    '    <Connect FromSheet="5" ToSheet="4"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeDuplicateShapeIdMultipageCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page2.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Duplicate-ID-Connected" Name="Duplicate ID Connected">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="7"/>',
    '      <Cell N="PageHeight" V="4"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '  <Page ID="1" NameU="Duplicate-ID-Missing-Connects" Name="Duplicate ID Missing Connects">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="7"/>',
    '      <Cell N="PageHeight" V="4"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId2"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Source" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="2"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Page 1 Source</Text></Shape>',
    '    <Shape ID="2" NameU="Target" Type="Shape"><Cell N="PinX" V="5"/><Cell N="PinY" V="2"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Page 1 Target</Text></Shape>',
    '    <Shape ID="3" NameU="Dynamic connector" Type="Shape" OneD="1"><Cell N="BeginX" V="1"/><Cell N="BeginY" V="2"/><Cell N="EndX" V="5"/><Cell N="EndY" V="2"/></Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="3" ToSheet="1"/>',
    '    <Connect FromSheet="3" ToSheet="2"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));
  zip.file('visio/pages/page2.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Source" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="2"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Page 2 Source</Text></Shape>',
    '    <Shape ID="2" NameU="Target" Type="Shape"><Cell N="PinX" V="5"/><Cell N="PinY" V="2"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Page 2 Target</Text></Shape>',
    '    <Shape ID="3" NameU="Dynamic connector" Type="Shape" OneD="1"><Cell N="BeginX" V="1"/><Cell N="BeginY" V="2"/><Cell N="EndX" V="5"/><Cell N="EndY" V="2"/></Shape>',
    '  </Shapes>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeDuplicateShapeIdSamePageGroupCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Duplicate-ID-Same-Page-Group-Corpus" Name="Duplicate ID Same Page Group Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="8"/>',
    '      <Cell N="PageHeight" V="5"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Group" Type="Group">',
    '      <Cell N="PinX" V="4"/><Cell N="PinY" V="2.5"/><Cell N="Width" V="6"/><Cell N="Height" V="3"/>',
    '      <Cell N="LocPinX" V="3"/><Cell N="LocPinY" V="1.5"/><Text>Duplicate ID Boundary</Text>',
    '      <Shapes>',
    '        <Shape ID="2" NameU="Process" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="1.5"/><Cell N="Width" V="1"/><Cell N="Height" V="0.7"/><Text>Declared Source</Text></Shape>',
    '        <Shape ID="2" NameU="Process" Type="Shape"><Cell N="PinX" V="3"/><Cell N="PinY" V="1.5"/><Cell N="Width" V="1"/><Cell N="Height" V="0.7"/><Text>Ambiguous Middle</Text></Shape>',
    '        <Shape ID="4" NameU="Process" Type="Shape"><Cell N="PinX" V="5"/><Cell N="PinY" V="1.5"/><Cell N="Width" V="1"/><Cell N="Height" V="0.7"/><Text>Target</Text></Shape>',
    '        <Shape ID="5" NameU="Dynamic connector" Type="Shape" OneD="1"><Cell N="BeginX" V="1"/><Cell N="BeginY" V="1.5"/><Cell N="EndX" V="5"/><Cell N="EndY" V="1.5"/></Shape>',
    '      </Shapes>',
    '    </Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="5" ToSheet="2"/>',
    '    <Connect FromSheet="5" ToSheet="4"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeDuplicateConnectorIdSamePageCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Duplicate-Connector-ID-Same-Page-Corpus" Name="Duplicate Connector ID Same Page Corpus">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="7"/>',
    '      <Cell N="PageHeight" V="4"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Source" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="2"/><Cell N="Width" V="0.9"/><Cell N="Height" V="0.7"/><Text>Source</Text></Shape>',
    '    <Shape ID="2" NameU="Target" Type="Shape"><Cell N="PinX" V="5"/><Cell N="PinY" V="2"/><Cell N="Width" V="0.9"/><Cell N="Height" V="0.7"/><Text>Target</Text></Shape>',
    '    <Shape ID="3" NameU="Dynamic connector" Type="Shape" OneD="1"><Cell N="BeginX" V="1"/><Cell N="BeginY" V="2"/><Cell N="EndX" V="5"/><Cell N="EndY" V="2"/></Shape>',
    '    <Shape ID="3" NameU="Dynamic connector" Type="Shape" OneD="1"><Cell N="BeginX" V="1"/><Cell N="BeginY" V="2.3"/><Cell N="EndX" V="5"/><Cell N="EndY" V="2.3"/></Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="3" ToSheet="1"/>',
    '    <Connect FromSheet="3" ToSheet="2"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

async function writeInvalidConnectsMultipageCorpusVsdx(outputPath: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '</Types>'
  ].join(''));
  zip.file('visio/pages/_rels/pages.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page2.xml"/>',
    '</Relationships>'
  ].join(''));
  zip.file('visio/pages/pages.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <Page ID="0" NameU="Invalid-Connects-Valid-Local-Targets" Name="Invalid Connects Valid Local Targets">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="8"/>',
    '      <Cell N="PageHeight" V="4"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId1"/>',
    '  </Page>',
    '  <Page ID="1" NameU="Invalid-Connects-Missing-Local-Targets" Name="Invalid Connects Missing Local Targets">',
    '    <PageSheet>',
    '      <Cell N="PageWidth" V="7"/>',
    '      <Cell N="PageHeight" V="4"/>',
    '    </PageSheet>',
    '    <Rel r:id="rId2"/>',
    '  </Page>',
    '</Pages>'
  ].join('\n'));
  zip.file('visio/pages/page1.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Source" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="2"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Local Source</Text></Shape>',
    '    <Shape ID="2" NameU="Target" Type="Shape"><Cell N="PinX" V="4"/><Cell N="PinY" V="2"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Local Target</Text></Shape>',
    '    <Shape ID="3" NameU="Dynamic connector" Type="Shape" OneD="1"><Cell N="BeginX" V="1"/><Cell N="BeginY" V="2"/><Cell N="EndX" V="4"/><Cell N="EndY" V="2"/></Shape>',
    '    <Shape ID="42" NameU="CrossPageOnly" Type="Shape"><Cell N="PinX" V="7"/><Cell N="PinY" V="2"/><Cell N="Width" V="0.8"/><Cell N="Height" V="0.8"/><Text>Page 1 Only</Text></Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="3" ToSheet="1"/>',
    '    <Connect FromSheet="3" ToSheet="2"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));
  zip.file('visio/pages/page2.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">',
    '  <Shapes>',
    '    <Shape ID="1" NameU="Source" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="2"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Page 2 Source</Text></Shape>',
    '    <Shape ID="2" NameU="Target" Type="Shape"><Cell N="PinX" V="5"/><Cell N="PinY" V="2"/><Cell N="Width" V="1.2"/><Cell N="Height" V="0.8"/><Text>Page 2 Target</Text></Shape>',
    '    <Shape ID="3" NameU="Dynamic connector" Type="Shape" OneD="1"><Cell N="BeginX" V="1"/><Cell N="BeginY" V="2"/><Cell N="EndX" V="5"/><Cell N="EndY" V="2"/></Shape>',
    '  </Shapes>',
    '  <Connects>',
    '    <Connect FromSheet="3" ToSheet="42"/>',
    '    <Connect FromSheet="3" ToSheet="999"/>',
    '  </Connects>',
    '</PageContents>'
  ].join('\n'));

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, content);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertPreviewFreshnessSummaryHelpers(): void {
  assert(normalizePreviewFreshnessReason('source size changed: cache=1, current=2') === 'source size changed', 'expected source size reason to normalize by prefix');
  assert(
    normalizePreviewFreshnessReason('preview file is invalid: C:\\temp\\preview.png (PNG file is too small)') === 'preview file is invalid: PNG file is too small',
    'expected invalid preview reason to normalize by concrete failure'
  );
  assert(formatPreviewFreshnessSummaryFiles(['a.vsdx', 'b.vsdx', 'c.vsdx', 'd.vsdx']) === 'a.vsdx; b.vsdx; c.vsdx; +1 more', 'expected preview summary files to truncate with remainder count');
  assert(formatPreviewFreshnessSummaryFiles([]) === '-', 'expected empty preview summary files to use dash');
  const reasonKeys = toPreviewFreshnessReasonKeys([
    'source mtime changed: cache=1, current=2',
    'preview file is invalid: C:\\temp\\preview.png (blank PNG image data)',
    'source mtime changed: cache=3, current=4'
  ]);
  assert(reasonKeys.join(';') === 'preview file is invalid: blank PNG image data;source mtime changed', 'expected normalized reason keys to dedupe and sort');

  const summary = summarizePreviewFreshnessReasonsForItems([
    {
      relativePath: 'b.vsdx',
      previewFreshnessReasons: [
        'source mtime changed: cache=1, current=2',
        'preview file is invalid: C:\\temp\\b.png (blank PNG image data)'
      ]
    },
    {
      relativePath: 'a.vsdx',
      previewFreshnessReasons: [
        'source mtime changed: cache=3, current=4',
        'preview file is invalid: C:\\temp\\a.png (blank PNG image data)'
      ]
    }
  ]);
  const sourceMtime = summary.find(item => item.reason === 'source mtime changed');
  assert(sourceMtime !== undefined && sourceMtime.count === 2, 'expected source mtime reasons to aggregate');
  assert(sourceMtime.files.join(';') === 'a.vsdx;b.vsdx', 'expected source mtime sample files to sort');
  const blankPreview = summary.find(item => item.reason === 'preview file is invalid: blank PNG image data');
  assert(blankPreview !== undefined && blankPreview.count === 2, 'expected blank preview reasons to aggregate');
  assert(blankPreview.files.join(';') === 'a.vsdx;b.vsdx', 'expected invalid preview sample files to sort');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
