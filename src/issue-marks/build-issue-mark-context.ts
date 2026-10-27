import type { CapturedAction } from '@/src/domain/action';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import {
  ISSUE_MARK_ACTION_WINDOW,
  ISSUE_MARK_RELATED_ISSUE_LOOKBACK_MS,
  type IssueMarkRelatedIssue,
} from '@/src/domain/issue-mark';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type { ActiveSessionSnapshot } from '@/src/domain/session';
import type { UiIssue } from '@/src/domain/ui-issue';
import { getMonitoredPathname } from '@/src/sidepanel/session-display';

export type IssueMarkContextInput = {
  session: ActiveSessionSnapshot;
  markedAt: number;
  sanitizedPageUrl: string;
  actions: CapturedAction[];
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
};

export type IssueMarkContextSlice = {
  pageUrl: string;
  pageTitle?: string;
  pathname: string;
  actionIds: string[];
  relatedIssues: IssueMarkRelatedIssue[];
};

export function buildIssueMarkContext(
  input: IssueMarkContextInput,
): IssueMarkContextSlice {
  const actionIds = selectActionIdsBeforeMark(
    input.actions,
    input.session.id,
    input.markedAt,
    ISSUE_MARK_ACTION_WINDOW,
  );
  const relatedIssues = selectRelatedIssuesInWindow(
    {
      uiIssues: input.uiIssues,
      consoleIssues: input.consoleIssues,
      networkIssues: input.networkIssues,
    },
    input.session.id,
    input.markedAt,
    ISSUE_MARK_RELATED_ISSUE_LOOKBACK_MS,
  );

  const pageTitle = input.session.pageTitle?.trim();
  return {
    pageUrl: input.sanitizedPageUrl,
    pageTitle:
      pageTitle === undefined || pageTitle.length === 0 ? undefined : pageTitle,
    pathname: getMonitoredPathname({
      ...input.session,
      targetUrl: input.sanitizedPageUrl,
    }),
    actionIds,
    relatedIssues,
  };
}

export function selectActionIdsBeforeMark(
  actions: CapturedAction[],
  sessionId: string,
  markedAt: number,
  limit: number,
): string[] {
  const eligible = actions
    .filter(
      (action) =>
        action.sessionId === sessionId && action.timestamp <= markedAt,
    )
    .sort((left, right) => right.timestamp - left.timestamp);
  return eligible.slice(0, limit).map((action) => action.id);
}

export function selectRelatedIssuesInWindow(
  issues: {
    uiIssues: UiIssue[];
    consoleIssues: ConsoleIssue[];
    networkIssues: NetworkIssue[];
  },
  sessionId: string,
  markedAt: number,
  lookbackMs: number,
): IssueMarkRelatedIssue[] {
  const windowStart = markedAt - lookbackMs;
  const related: IssueMarkRelatedIssue[] = [];

  for (const issue of issues.uiIssues) {
    if (issue.sessionId !== sessionId) {
      continue;
    }
    if (issue.lastSeenAt >= windowStart && issue.lastSeenAt <= markedAt) {
      related.push({ category: 'ui', issueId: issue.id });
    }
  }
  for (const issue of issues.consoleIssues) {
    if (issue.sessionId !== sessionId) {
      continue;
    }
    if (issue.lastSeenAt >= windowStart && issue.lastSeenAt <= markedAt) {
      related.push({ category: 'console', issueId: issue.id });
    }
  }
  for (const issue of issues.networkIssues) {
    if (issue.sessionId !== sessionId) {
      continue;
    }
    if (issue.lastSeenAt >= windowStart && issue.lastSeenAt <= markedAt) {
      related.push({ category: 'network', issueId: issue.id });
    }
  }

  return related;
}
