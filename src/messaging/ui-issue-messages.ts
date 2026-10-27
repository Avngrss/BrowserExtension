import { parseUiIssueList } from '@/src/ui/ui-issue-validation';
import type { UiIssueStore } from '@/src/ui/ui-issue-store';
import {
  GET_UI_ISSUE_LIST,
  SUBMIT_UI_ISSUE,
  UI_ISSUE_LIST_UPDATED,
  type UiIssueListResponse,
  type UiIssueListSuccessResponse,
  type UiIssueListUpdatedMessage,
  type UiIssueRequestMessage,
  type UiIssueRequestType,
} from '@/src/messaging/ui-issue-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const UI_ISSUE_REQUEST_TYPES: readonly UiIssueRequestType[] = [
  SUBMIT_UI_ISSUE,
  GET_UI_ISSUE_LIST,
];

function isUiIssueRequestType(value: unknown): value is UiIssueRequestType {
  return (
    typeof value === 'string' &&
    UI_ISSUE_REQUEST_TYPES.some((requestType) => requestType === value)
  );
}

export function isUiIssueRequestMessage(
  message: unknown,
): message is UiIssueRequestMessage {
  return isRecord(message) && isUiIssueRequestType(message.type);
}

export function isUiIssueListUpdatedMessage(
  message: unknown,
): message is UiIssueListUpdatedMessage {
  if (!isRecord(message) || message.type !== UI_ISSUE_LIST_UPDATED) {
    return false;
  }
  return parseUiIssueList(message.issues) !== null;
}

export function isUiIssueListResponse(
  value: unknown,
): value is UiIssueListResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false;
  }

  if (value.ok) {
    return parseUiIssueList(value.issues) !== null;
  }

  return (
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

export async function handleUiIssueRequestMessage(
  message: UiIssueRequestMessage,
  issueStore: UiIssueStore,
  senderTabId: number | undefined,
): Promise<UiIssueListResponse | undefined> {
  if (message.type === GET_UI_ISSUE_LIST) {
    return issueStore.getIssueList();
  }

  if (message.type === SUBMIT_UI_ISSUE) {
    return issueStore.submitIssue(message.issue, senderTabId);
  }

  return undefined;
}

export function createUiIssueListUpdatedMessage(
  issues: UiIssueListUpdatedMessage['issues'],
): UiIssueListUpdatedMessage {
  return {
    type: UI_ISSUE_LIST_UPDATED,
    issues,
  };
}

export function shouldBroadcastUiIssueUpdate(
  message: unknown,
  response: unknown,
): response is UiIssueListSuccessResponse {
  return (
    isUiIssueRequestMessage(message) &&
    message.type === SUBMIT_UI_ISSUE &&
    isUiIssueListResponse(response) &&
    response.ok
  );
}
