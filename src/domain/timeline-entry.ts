import type { CapturedAction } from '@/src/domain/action';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type { UiIssue } from '@/src/domain/ui-issue';

export type TimelineEntry =
  | { kind: 'action'; timestamp: number; action: CapturedAction }
  | { kind: 'console-issue'; timestamp: number; issue: ConsoleIssue }
  | { kind: 'ui-issue'; timestamp: number; issue: UiIssue }
  | { kind: 'network-issue'; timestamp: number; issue: NetworkIssue };

function kindOrder(kind: TimelineEntry['kind']): number {
  switch (kind) {
    case 'action':
      return 0;
    case 'console-issue':
      return 1;
    case 'ui-issue':
      return 2;
    case 'network-issue':
      return 3;
  }
}

export function mergeTimelineEntries(
  actions: CapturedAction[],
  consoleIssues: ConsoleIssue[],
  networkIssues: NetworkIssue[] = [],
  uiIssues: UiIssue[] = [],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...actions.map(
      (action) =>
        ({
          kind: 'action',
          timestamp: action.timestamp,
          action,
        }) satisfies TimelineEntry,
    ),
    ...consoleIssues.map(
      (issue) =>
        ({
          kind: 'console-issue',
          timestamp: issue.timestamp,
          issue,
        }) satisfies TimelineEntry,
    ),
    ...networkIssues.map(
      (issue) =>
        ({
          kind: 'network-issue',
          timestamp: issue.timestamp,
          issue,
        }) satisfies TimelineEntry,
    ),
    ...uiIssues.map(
      (issue) =>
        ({
          kind: 'ui-issue',
          timestamp: issue.timestamp,
          issue,
        }) satisfies TimelineEntry,
    ),
  ];

  entries.sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp;
    }
    return kindOrder(left.kind) - kindOrder(right.kind);
  });

  return entries;
}
