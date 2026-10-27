export const ISSUE_MARK_SCREENSHOT_ISSUE_ID = 'user-mark';

export const ISSUE_MARK_NOTE_MAX_LENGTH = 1_000;

export const ISSUE_MARK_ACTION_WINDOW = 10;

export const ISSUE_MARK_RELATED_ISSUE_LOOKBACK_MS = 60_000;

export type IssueMarkReportScope = 'around-mark' | 'full-session';

export type IssueMarkReportScopeWithoutMark =
  'last-10-actions' | 'full-session';

export type IssueMarkRelatedIssue = {
  category: 'ui' | 'console' | 'network';
  issueId: string;
};

export type IssueMark = {
  sessionId: string;
  markedAt: number;
  note?: string;
  pageUrl: string;
  pageTitle?: string;
  pathname: string;
  actionIds: string[];
  relatedIssues: IssueMarkRelatedIssue[];
  reportScope: IssueMarkReportScope;
};

export type IssueMarkSessionData = {
  mark: IssueMark | null;
  reportScopeWithoutMark: IssueMarkReportScopeWithoutMark;
};

export function createDefaultIssueMarkSessionData(): IssueMarkSessionData {
  return {
    mark: null,
    reportScopeWithoutMark: 'last-10-actions',
  };
}
