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
    return `The page displayed “${safe}”.`;
  }
  const ruleName = issue.ruleName.trim();
  if (ruleName.length > 0) {
    return `The page displayed a UI alert from “${ruleName}”.`;
  }
  return 'The page displayed a UI alert.';
}

function consoleIssueDraft(issue: ConsoleIssue): string {
  const message = truncateCapturedText(issue.message) ?? issue.message.trim();
  return `A JavaScript error was recorded: “${message}”.`;
}

function networkIssueDraft(issue: NetworkIssue): string {
  const path = formatActionTimelinePath(issue.url);
  const status =
    issue.status !== undefined ? ` returned HTTP ${issue.status}` : '';
  return `${issue.method} ${path}${status}.`;
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
