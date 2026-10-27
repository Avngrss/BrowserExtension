import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { NetworkIssue } from '@/src/domain/network-issue';
import { formatActionTimelinePath } from '@/src/privacy/timeline-url';
import { truncateCapturedText } from '@/src/privacy/text-sanitizer';

function consoleCategoryLabel(category: ConsoleIssue['category']): string {
  switch (category) {
    case 'console-error':
      return 'Console error';
    case 'uncaught-error':
      return 'Uncaught error';
    case 'unhandled-rejection':
      return 'Unhandled rejection';
  }
}

function occurrenceSuffix(count: number): string {
  return count > 1 ? ` · ${count} occurrences` : '';
}

export function formatConsoleTechnicalEvidence(issue: ConsoleIssue): string {
  const message = truncateCapturedText(issue.message) ?? issue.message;
  return `${consoleCategoryLabel(issue.category)}: ${message}${occurrenceSuffix(issue.occurrenceCount)}`;
}

export function formatNetworkTechnicalEvidence(issue: NetworkIssue): string {
  const source = issue.source === 'fetch' ? 'Fetch' : 'XHR';
  const path = formatActionTimelinePath(issue.url);
  const status = issue.status !== undefined ? ` · status ${issue.status}` : '';
  const duration =
    issue.durationMs !== undefined ? ` · ${issue.durationMs} ms` : '';
  return `${source} ${issue.method} ${path}${status}${duration}${occurrenceSuffix(issue.occurrenceCount)}`;
}
