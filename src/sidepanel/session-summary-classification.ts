import type { BugReportContext } from '@/src/domain/bug-report-context';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { IssueMark } from '@/src/domain/issue-mark';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type { UiIssue } from '@/src/domain/ui-issue';
import { sessionHasBugSignal } from '@/src/sidepanel/session-bug-signal';

export type SessionSummaryPresentationMode =
  'pending' | 'activity' | 'bug-report';

function hasImmediateBugSignal(input: {
  mark: IssueMark | null;
  bugContext: BugReportContext | null;
}): boolean {
  if (input.mark !== null) {
    return true;
  }
  const whatHappened = input.bugContext?.whatHappened?.trim();
  return whatHappened !== undefined && whatHappened.length > 0;
}

export function resolveSessionSummaryPresentationMode(input: {
  sessionId: string;
  mark: IssueMark | null;
  bugContext: BugReportContext | null;
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
  classificationReady: boolean;
}): SessionSummaryPresentationMode {
  if (!input.classificationReady) {
    return hasImmediateBugSignal(input) ? 'bug-report' : 'pending';
  }
  return sessionHasBugSignal({
    sessionId: input.sessionId,
    mark: input.mark,
    bugContext: input.bugContext,
    uiIssues: input.uiIssues,
    consoleIssues: input.consoleIssues,
    networkIssues: input.networkIssues,
  })
    ? 'bug-report'
    : 'activity';
}
