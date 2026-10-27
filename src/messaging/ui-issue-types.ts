import type { UiIssue } from '@/src/domain/ui-issue';

export const SUBMIT_UI_ISSUE = 'SUBMIT_UI_ISSUE';
export const GET_UI_ISSUE_LIST = 'GET_UI_ISSUE_LIST';
export const UI_ISSUE_LIST_UPDATED = 'UI_ISSUE_LIST_UPDATED';

export type UiIssueRequestType =
  typeof SUBMIT_UI_ISSUE | typeof GET_UI_ISSUE_LIST;

export type SubmitUiIssueMessage = {
  type: typeof SUBMIT_UI_ISSUE;
  issue: unknown;
};

export type GetUiIssueListMessage = {
  type: typeof GET_UI_ISSUE_LIST;
};

export type UiIssueRequestMessage =
  SubmitUiIssueMessage | GetUiIssueListMessage;

export type UiIssueListUpdatedMessage = {
  type: typeof UI_ISSUE_LIST_UPDATED;
  issues: UiIssue[];
};

export type UiIssueListSuccessResponse = {
  ok: true;
  issues: UiIssue[];
};

export type UiIssueErrorResponse = {
  ok: false;
  error: {
    code:
      | 'STORAGE_ERROR'
      | 'UI_ISSUE_LIMIT_REACHED'
      | 'INVALID_UI_ISSUE'
      | 'STALE_UI_ISSUE'
      | 'INVALID_MESSAGE';
    message: string;
  };
};

export type UiIssueListResponse =
  UiIssueListSuccessResponse | UiIssueErrorResponse;
