export interface PreviewFreshnessSummarySourceItem {
  relativePath: string;
  previewFreshnessReasons: string[];
}

export interface PreviewFreshnessSummaryItem {
  reason: string;
  count: number;
  files: string[];
}

export function summarizePreviewFreshnessReasonsForItems(
  items: PreviewFreshnessSummarySourceItem[]
): PreviewFreshnessSummaryItem[] {
  const summaries = new Map<string, PreviewFreshnessSummaryItem>();

  for (const item of items) {
    for (const rawReason of item.previewFreshnessReasons) {
      const reason = normalizePreviewFreshnessReason(rawReason);
      const summary = summaries.get(reason) ?? { reason, count: 0, files: [] };
      summary.count += 1;
      if (!summary.files.includes(item.relativePath)) {
        summary.files.push(item.relativePath);
      }
      summaries.set(reason, summary);
    }
  }

  return Array.from(summaries.values())
    .map(summary => ({
      ...summary,
      files: summary.files.sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

export function normalizePreviewFreshnessReason(reason: string): string {
  const invalidPreviewMatch = reason.match(/^preview file is invalid: .* \((.+)\)$/);
  if (invalidPreviewMatch) {
    return `preview file is invalid: ${invalidPreviewMatch[1]}`;
  }

  const prefixes = [
    'source mtime changed',
    'source size changed',
    'preview mtime changed',
    'preview size changed',
    'preview file missing',
    'cache record preview path mismatch',
    'cache record format mismatch',
    'preview freshness inspection failed'
  ];
  const prefix = prefixes.find(candidate => reason.startsWith(candidate));
  return prefix ?? reason;
}

export function toPreviewFreshnessReasonKeys(reasons: string[]): string[] {
  return Array.from(new Set(reasons.map(normalizePreviewFreshnessReason)))
    .sort((a, b) => a.localeCompare(b));
}

export function formatPreviewFreshnessSummaryFiles(files: string[], maxFiles = 3): string {
  const visible = files.slice(0, maxFiles);
  const suffix = files.length > visible.length ? `; +${files.length - visible.length} more` : '';
  return `${visible.join('; ')}${suffix}` || '-';
}
