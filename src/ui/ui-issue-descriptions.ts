import type { UiIssue } from '@/src/domain/ui-issue';

export function describeUiIssue(issue: UiIssue): string {
  const severityLabel = issue.severity === 'error' ? 'UI error' : 'UI warning';
  if (issue.visibleMessage !== undefined && issue.visibleMessage.length > 0) {
    return `${severityLabel}: ${issue.visibleMessage}`;
  }
  return `${severityLabel} detected by “${issue.ruleName}”`;
}
