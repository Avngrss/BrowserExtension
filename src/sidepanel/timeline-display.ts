import type { TimelineEntry } from '@/src/domain/timeline-entry';
import type { IssueReviewCategory } from '@/src/domain/issue-disposition';
import { describeCapturedAction } from '@/src/actions/action-descriptions';
import { describeConsoleIssue } from '@/src/console/console-issue-descriptions';
import { describeNetworkIssue } from '@/src/network/network-issue-descriptions';
import { describeUiIssue } from '@/src/ui/ui-issue-descriptions';
import { formatActionTimelinePath } from '@/src/privacy/timeline-url';

export type TimelineCategoryBadge = 'Action' | 'UI' | 'Console' | 'Network';

export function timelineCategoryBadge(
  entry: TimelineEntry,
): TimelineCategoryBadge | undefined {
  switch (entry.kind) {
    case 'action':
      return 'Action';
    case 'ui-issue':
      return 'UI';
    case 'console-issue':
      return 'Console';
    case 'network-issue':
      return 'Network';
  }
}

export function timelineReadableDescription(entry: TimelineEntry): string {
  if (entry.kind === 'action') {
    return describeCapturedAction(entry.action);
  }
  if (entry.kind === 'console-issue') {
    return describeConsoleIssue(entry.issue);
  }
  if (entry.kind === 'ui-issue') {
    return describeUiIssue(entry.issue);
  }
  return describeNetworkIssue(entry.issue);
}

export function timelinePathname(entry: TimelineEntry): string {
  if (entry.kind === 'action') {
    return formatActionTimelinePath(entry.action.url);
  }
  return formatActionTimelinePath(entry.issue.url);
}

export function timelineReviewCategory(
  entry: Exclude<TimelineEntry, { kind: 'action' }>,
): IssueReviewCategory {
  switch (entry.kind) {
    case 'console-issue':
      return 'console';
    case 'ui-issue':
      return 'ui';
    case 'network-issue':
      return 'network';
  }
}

export function formatTimelineClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
