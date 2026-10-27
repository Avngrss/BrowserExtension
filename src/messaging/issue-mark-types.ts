import type {
  IssueMark,
  IssueMarkReportScope,
  IssueMarkReportScopeWithoutMark,
  IssueMarkSessionData,
} from '@/src/domain/issue-mark';

export const GET_ISSUE_MARK = 'GET_ISSUE_MARK';
export const SAVE_ISSUE_MARK = 'SAVE_ISSUE_MARK';
export const SET_ISSUE_MARK_REPORT_SCOPE = 'SET_ISSUE_MARK_REPORT_SCOPE';
export const SET_REPORT_SCOPE_WITHOUT_MARK = 'SET_REPORT_SCOPE_WITHOUT_MARK';
export const ISSUE_MARK_UPDATED = 'ISSUE_MARK_UPDATED';

export type GetIssueMarkMessage = { type: typeof GET_ISSUE_MARK };

export type SaveIssueMarkMessage = {
  type: typeof SAVE_ISSUE_MARK;
  note?: string;
  replaceExisting: boolean;
};

export type SetIssueMarkReportScopeMessage = {
  type: typeof SET_ISSUE_MARK_REPORT_SCOPE;
  scope: IssueMarkReportScope;
};

export type SetReportScopeWithoutMarkMessage = {
  type: typeof SET_REPORT_SCOPE_WITHOUT_MARK;
  scope: IssueMarkReportScopeWithoutMark;
};

export type IssueMarkUpdatedMessage = {
  type: typeof ISSUE_MARK_UPDATED;
  data: IssueMarkSessionData;
};

export type IssueMarkRequestMessage =
  | GetIssueMarkMessage
  | SaveIssueMarkMessage
  | SetIssueMarkReportScopeMessage
  | SetReportScopeWithoutMarkMessage;

export type IssueMarkResponse =
  | { ok: true; data: IssueMarkSessionData }
  | {
      ok: false;
      error: {
        code:
          | 'NO_ACTIVE_SESSION'
          | 'INVALID_NOTE'
          | 'MARK_EXISTS'
          | 'STORAGE_ERROR';
        message: string;
      };
    };

export type SaveIssueMarkResult =
  { ok: true; mark: IssueMark } | IssueMarkResponse;
