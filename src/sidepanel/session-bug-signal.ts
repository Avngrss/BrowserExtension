import type { BugReportContext } from '@/src/domain/bug-report-context';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { IssueMark } from '@/src/domain/issue-mark';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type { UiIssue } from '@/src/domain/ui-issue';

export function sessionHasNonExcludedIssue(input: {
  sessionId: string;
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
}): boolean {
  const inSession = (issue: { sessionId: string; disposition: string }) =>
    issue.sessionId === input.sessionId && issue.disposition !== 'excluded';

  return (
    input.uiIssues.some(inSession) ||
    input.consoleIssues.some(inSession) ||
    input.networkIssues.some(inSession)
  );
}

export function sessionHasBugSignal(input: {
  sessionId: string;
  mark: IssueMark | null;
  bugContext: BugReportContext | null;
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
}): boolean {
  if (input.mark !== null) {
    return true;
  }
  const whatHappened = input.bugContext?.whatHappened?.trim();
  if (whatHappened !== undefined && whatHappened.length > 0) {
    return true;
  }
  return sessionHasNonExcludedIssue({
    sessionId: input.sessionId,
    uiIssues: input.uiIssues,
    consoleIssues: input.consoleIssues,
    networkIssues: input.networkIssues,
  });
}
