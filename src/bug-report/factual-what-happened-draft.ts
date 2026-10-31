import type { BugReportContext } from '@/src/domain/bug-report-context';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { IssueMark } from '@/src/domain/issue-mark';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type { UiIssue } from '@/src/domain/ui-issue';
import { formatActionTimelinePath } from '@/src/privacy/timeline-url';
import { truncateCapturedText } from '@/src/privacy/text-sanitizer';

function firstIncludedIssue<
  T extends { sessionId: string; disposition: string },
>(issues: T[], sessionId: string): T | undefined {
  return issues.find(
    (issue) =>
      issue.sessionId === sessionId && issue.disposition !== 'excluded',
  );
}

export function uiIssueFactualDraft(issue: UiIssue): string {
  return uiIssueDraft(issue);
}

export function consoleIssueFactualDraft(issue: ConsoleIssue): string {
  return consoleIssueDraft(issue);
}

export function networkIssueFactualDraft(issue: NetworkIssue): string {
  return networkIssueDraft(issue);
}

function uiIssueDraft(issue: UiIssue): string {
  const message = issue.visibleMessage?.trim();
  if (message !== undefined && message.length > 0) {
    const safe = truncateCapturedText(message) ?? message;
    return `The page shows “${safe}”.`;
  }
  const ruleName = issue.ruleName.trim();
  if (ruleName.length > 0) {
    return `The page shows a UI alert from “${ruleName}”.`;
  }
  return 'The page shows a UI alert.';
}

function consoleIssueDraft(issue: ConsoleIssue): string {
  const message = truncateCapturedText(issue.message) ?? issue.message.trim();
  return `The browser console shows an error: “${message}”.`;
}

function networkIssueDraft(issue: NetworkIssue): string {
  const path = formatActionTimelinePath(issue.url);
  if (issue.status !== undefined && issue.status >= 400) {
    return `The ${issue.method} request to ${path} fails with HTTP ${issue.status}.`;
  }
  const failure = issue.failureMessage?.trim();
  if (failure !== undefined && failure.length > 0) {
    const safe = truncateCapturedText(failure) ?? failure;
    return `The ${issue.method} request to ${path} fails: “${safe}”.`;
  }
  if (issue.category === 'timeout') {
    return `The ${issue.method} request to ${path} times out.`;
  }
  if (issue.category === 'aborted') {
    return `The ${issue.method} request to ${path} is aborted.`;
  }
  return `The ${issue.method} request to ${path} fails.`;
}

export function buildFactualWhatHappenedDraft(input: {
  sessionId: string;
  mark: IssueMark | null;
  savedBugContext: BugReportContext | null;
  bugContextLoaded: boolean;
  classificationReady: boolean;
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
}): string | undefined {
  if (!input.bugContextLoaded || !input.classificationReady) {
    return undefined;
  }
  if (input.savedBugContext !== null) {
    return undefined;
  }

  const markNote = input.mark?.note?.trim();
  if (markNote !== undefined && markNote.length > 0) {
    return markNote;
  }

  const ui = firstIncludedIssue(input.uiIssues, input.sessionId);
  if (ui !== undefined) {
    return uiIssueDraft(ui);
  }

  const consoleIssue = firstIncludedIssue(input.consoleIssues, input.sessionId);
  if (consoleIssue !== undefined) {
    return consoleIssueDraft(consoleIssue);
  }

  const networkIssue = firstIncludedIssue(input.networkIssues, input.sessionId);
  if (networkIssue !== undefined) {
    return networkIssueDraft(networkIssue);
  }

  return undefined;
}
