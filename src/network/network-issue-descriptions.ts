import type { NetworkIssue } from '@/src/domain/network-issue';
import { formatActionTimelinePath } from '@/src/privacy/timeline-url';

function sourceLabel(source: NetworkIssue['source']): string {
  return source === 'fetch' ? 'Fetch' : 'XHR';
}

function categoryDetail(issue: NetworkIssue): string {
  if (issue.category === 'http-error' && issue.status !== undefined) {
    return String(issue.status);
  }
  switch (issue.category) {
    case 'network-failure':
      return 'Network failure';
    case 'timeout':
      return 'Timeout';
    case 'aborted':
      return 'Aborted';
    default:
      return 'Error';
  }
}

export function describeNetworkIssue(issue: NetworkIssue): string {
  const path = formatActionTimelinePath(issue.url);
  return `${sourceLabel(issue.source)} failed: ${issue.method} ${path} · ${categoryDetail(issue)}`;
}
