import type { NetworkIssue } from '@/src/domain/network-issue';

export const SUBMIT_NETWORK_ISSUE = 'SUBMIT_NETWORK_ISSUE';
export const GET_NETWORK_ISSUE_LIST = 'GET_NETWORK_ISSUE_LIST';
export const NETWORK_ISSUE_LIST_UPDATED = 'NETWORK_ISSUE_LIST_UPDATED';

export type NetworkIssueRequestType =
  typeof SUBMIT_NETWORK_ISSUE | typeof GET_NETWORK_ISSUE_LIST;

export type SubmitNetworkIssueMessage = {
  type: typeof SUBMIT_NETWORK_ISSUE;
  issue: unknown;
};

export type GetNetworkIssueListMessage = {
  type: typeof GET_NETWORK_ISSUE_LIST;
};

export type NetworkIssueRequestMessage =
  SubmitNetworkIssueMessage | GetNetworkIssueListMessage;

export type NetworkIssueListUpdatedMessage = {
  type: typeof NETWORK_ISSUE_LIST_UPDATED;
  issues: NetworkIssue[];
};

export type NetworkIssueListSuccessResponse = {
  ok: true;
  issues: NetworkIssue[];
};

export type NetworkIssueErrorResponse = {
  ok: false;
  error: {
    code:
      | 'STORAGE_ERROR'
      | 'NETWORK_ISSUE_LIMIT_REACHED'
      | 'INVALID_NETWORK_ISSUE'
      | 'STALE_NETWORK_ISSUE'
      | 'INVALID_MESSAGE';
    message: string;
  };
};

export type NetworkIssueListResponse =
  NetworkIssueListSuccessResponse | NetworkIssueErrorResponse;
