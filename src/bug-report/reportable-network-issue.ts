import type { NetworkIssue } from '@/src/domain/network-issue';

export function isReportableNetworkIssue(issue: NetworkIssue): boolean {
  if (
    issue.status !== undefined &&
    issue.status >= 400 &&
    issue.status <= 599
  ) {
    return true;
  }
  return (
    issue.category === 'network-failure' ||
    issue.category === 'timeout' ||
    issue.category === 'aborted'
  );
}
