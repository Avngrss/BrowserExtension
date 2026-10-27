import { parseNetworkIssueList } from '@/src/network/network-issue-validation';
import type { NetworkIssueStore } from '@/src/network/network-issue-store';
import {
  GET_NETWORK_ISSUE_LIST,
  NETWORK_ISSUE_LIST_UPDATED,
  SUBMIT_NETWORK_ISSUE,
  type NetworkIssueListResponse,
  type NetworkIssueListSuccessResponse,
  type NetworkIssueListUpdatedMessage,
  type NetworkIssueRequestMessage,
  type NetworkIssueRequestType,
} from '@/src/messaging/network-issue-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const NETWORK_ISSUE_REQUEST_TYPES: readonly NetworkIssueRequestType[] = [
  SUBMIT_NETWORK_ISSUE,
  GET_NETWORK_ISSUE_LIST,
];

function isNetworkIssueRequestType(
  value: unknown,
): value is NetworkIssueRequestType {
  return (
    typeof value === 'string' &&
    NETWORK_ISSUE_REQUEST_TYPES.some((requestType) => requestType === value)
  );
}

export function isNetworkIssueRequestMessage(
  message: unknown,
): message is NetworkIssueRequestMessage {
  return isRecord(message) && isNetworkIssueRequestType(message.type);
}

export function isNetworkIssueListUpdatedMessage(
  message: unknown,
): message is NetworkIssueListUpdatedMessage {
  if (!isRecord(message) || message.type !== NETWORK_ISSUE_LIST_UPDATED) {
    return false;
  }
  return parseNetworkIssueList(message.issues) !== null;
}

export function isNetworkIssueListResponse(
  value: unknown,
): value is NetworkIssueListResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false;
  }

  if (value.ok) {
    return parseNetworkIssueList(value.issues) !== null;
  }

  return (
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

export async function handleNetworkIssueRequestMessage(
  message: NetworkIssueRequestMessage,
  issueStore: NetworkIssueStore,
  senderTabId: number | undefined,
): Promise<NetworkIssueListResponse | undefined> {
  if (message.type === GET_NETWORK_ISSUE_LIST) {
    return issueStore.getIssueList();
  }

  if (message.type === SUBMIT_NETWORK_ISSUE) {
    return issueStore.submitIssue(message.issue, senderTabId);
  }

  return undefined;
}

export function createNetworkIssueListUpdatedMessage(
  issues: NetworkIssueListUpdatedMessage['issues'],
): NetworkIssueListUpdatedMessage {
  return {
    type: NETWORK_ISSUE_LIST_UPDATED,
    issues,
  };
}

export function shouldBroadcastNetworkIssueUpdate(
  message: unknown,
  response: unknown,
): response is NetworkIssueListSuccessResponse {
  return (
    isNetworkIssueRequestMessage(message) &&
    message.type === SUBMIT_NETWORK_ISSUE &&
    isNetworkIssueListResponse(response) &&
    response.ok
  );
}
