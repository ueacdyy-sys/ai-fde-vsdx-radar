import { QaResult } from '../types';

export function toQaSummaryMarkdown(result: QaResult): string {
  const previewFreshnessLines = result.previewFreshnessReasons?.length
    ? result.previewFreshnessReasons.map(reason => `- ${reason}`)
    : ['- No freshness issues found.'];
  const riskLines = result.risks.length === 0
    ? ['- No risks found.']
    : result.risks.map(risk => `- ${risk.severity.toUpperCase()} ${risk.code}${risk.page ? ` page=${risk.page}` : ''}: ${risk.message}`);

  const pageLines = result.pages.length === 0
    ? ['- No pages found.']
    : result.pages.map(page => `- Page ${page.name}: size=${page.width ?? '?'}x${page.height ?? '?'}, coverage=${page.pageCoverageRatio === undefined ? '?' : Math.round(page.pageCoverageRatio * 1000) / 10 + '%'}, shapes=${page.shapeCount}, text=${page.textShapeCount}, unlabeled=${page.unlabeledShapeCount}, oneD=${page.oneDShapeCount}, connects=${page.connectCount}, duplicateIds=${page.duplicateShapeIdCount}, straight=${page.straightConnectorCount}, orthogonal=${page.orthogonalConnectorCount}, complex=${page.complexConnectorCount}, diagonal=${page.diagonalConnectorCount}, crossings=${page.connectorCrossingCount}, dangling=${page.danglingConnectorCount}, overlaps=${page.shapeOverlapPairCount}, outOfBounds=${page.outOfBoundsShapeCount}, risks=${page.riskCount}`);

  return [
    '# AI-FDE VSDX QA Summary',
    '',
    `Source: \`${result.sourcePath}\``,
    result.sourceModifiedAt ? `Source modified: ${result.sourceModifiedAt}` : undefined,
    `Generated: ${result.generatedAt}`,
    `Preview: ${result.previewPath ? `\`${result.previewPath}\`` : 'missing'}`,
    `Preview fresh: ${result.previewFresh ? 'yes' : 'no'}`,
    '',
    '## Preview Freshness',
    '',
    ...previewFreshnessLines,
    '',
    '## Stats',
    '',
    `- Pages: ${result.stats.pageCount}`,
    `- Shapes: ${result.stats.shapeCount}`,
    `- Text shapes: ${result.stats.textShapeCount}`,
    `- Unlabeled shapes: ${result.stats.unlabeledShapeCount}`,
    `- OneD shapes: ${result.stats.oneDShapeCount}`,
    `- Connects: ${result.stats.connectCount}`,
    `- Duplicate Shape ID occurrences: ${result.stats.duplicateShapeIdCount}`,
    `- Out-of-bounds shapes: ${result.stats.outOfBoundsShapeCount}`,
    `- Straight connectors: ${result.stats.straightConnectorCount}`,
    `- Orthogonal connectors: ${result.stats.orthogonalConnectorCount}`,
    `- Complex connectors: ${result.stats.complexConnectorCount}`,
    `- Diagonal connectors: ${result.stats.diagonalConnectorCount}`,
    `- Connector crossings: ${result.stats.connectorCrossingCount}`,
    `- Dangling connectors: ${result.stats.danglingConnectorCount}`,
    `- Shape overlap pairs: ${result.stats.shapeOverlapPairCount}`,
    `- Average page coverage: ${result.stats.averagePageCoverageRatio === undefined ? '?' : Math.round(result.stats.averagePageCoverageRatio * 1000) / 10 + '%'}`,
    '',
    '## Pages',
    '',
    ...pageLines,
    '',
    '## Risks',
    '',
    ...riskLines,
    ''
  ].filter(line => line !== undefined).join('\n');
}
