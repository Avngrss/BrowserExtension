import type { ConsoleIssue } from '@/src/domain/console-issue';

export const SUBMIT_CONSOLE_ISSUE = 'SUBMIT_CONSOLE_ISSUE';
export const GET_CONSOLE_ISSUE_LIST = 'GET_CONSOLE_ISSUE_LIST';
export const CONSOLE_ISSUE_LIST_UPDATED = 'CONSOLE_ISSUE_LIST_UPDATED';

export type ConsoleIssueRequestType =
  typeof SUBMIT_CONSOLE_ISSUE | typeof GET_CONSOLE_ISSUE_LIST;

export type SubmitConsoleIssueMessage = {
  type: typeof SUBMIT_CONSOLE_ISSUE;
  issue: unknown;
};

export type GetConsoleIssueListMessage = {
  type: typeof GET_CONSOLE_ISSUE_LIST;
};

export type ConsoleIssueRequestMessage =
  SubmitConsoleIssueMessage | GetConsoleIssueListMessage;

export type ConsoleIssueListUpdatedMessage = {
  type: typeof CONSOLE_ISSUE_LIST_UPDATED;
  issues: ConsoleIssue[];
};

export type ConsoleIssueListSuccessResponse = {
  ok: true;
  issues: ConsoleIssue[];
};

export type ConsoleIssueErrorResponse = {
  ok: false;
  error: {
    code:
      | 'STORAGE_ERROR'
      | 'CONSOLE_ISSUE_LIMIT_REACHED'
      | 'INVALID_CONSOLE_ISSUE'
      | 'STALE_CONSOLE_ISSUE'
      | 'INVALID_MESSAGE';
    message: string;
  };
};

export type ConsoleIssueListResponse =
  ConsoleIssueListSuccessResponse | ConsoleIssueErrorResponse;
