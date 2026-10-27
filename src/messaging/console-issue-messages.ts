import { parseConsoleIssueList } from '@/src/console/console-issue-validation';
import type { ConsoleIssueStore } from '@/src/console/console-issue-store';
import {
  CONSOLE_ISSUE_LIST_UPDATED,
  GET_CONSOLE_ISSUE_LIST,
  SUBMIT_CONSOLE_ISSUE,
  type ConsoleIssueListResponse,
  type ConsoleIssueListSuccessResponse,
  type ConsoleIssueListUpdatedMessage,
  type ConsoleIssueRequestMessage,
  type ConsoleIssueRequestType,
} from '@/src/messaging/console-issue-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const CONSOLE_ISSUE_REQUEST_TYPES: readonly ConsoleIssueRequestType[] = [
  SUBMIT_CONSOLE_ISSUE,
  GET_CONSOLE_ISSUE_LIST,
];

function isConsoleIssueRequestType(
  value: unknown,
): value is ConsoleIssueRequestType {
  return (
    typeof value === 'string' &&
    CONSOLE_ISSUE_REQUEST_TYPES.some((requestType) => requestType === value)
  );
}

export function isConsoleIssueRequestMessage(
  message: unknown,
): message is ConsoleIssueRequestMessage {
  return isRecord(message) && isConsoleIssueRequestType(message.type);
}

export function isConsoleIssueListUpdatedMessage(
  message: unknown,
): message is ConsoleIssueListUpdatedMessage {
  if (!isRecord(message) || message.type !== CONSOLE_ISSUE_LIST_UPDATED) {
    return false;
  }
  return parseConsoleIssueList(message.issues) !== null;
}

export function isConsoleIssueListResponse(
  value: unknown,
): value is ConsoleIssueListResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false;
  }

  if (value.ok) {
    return parseConsoleIssueList(value.issues) !== null;
  }

  return (
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

export async function handleConsoleIssueRequestMessage(
  message: ConsoleIssueRequestMessage,
  issueStore: ConsoleIssueStore,
  senderTabId: number | undefined,
): Promise<ConsoleIssueListResponse | undefined> {
  if (message.type === GET_CONSOLE_ISSUE_LIST) {
    return issueStore.getIssueList();
  }

  if (message.type === SUBMIT_CONSOLE_ISSUE) {
    return issueStore.submitIssue(message.issue, senderTabId);
  }

  return undefined;
}

export function createConsoleIssueListUpdatedMessage(
  issues: ConsoleIssueListUpdatedMessage['issues'],
): ConsoleIssueListUpdatedMessage {
  return {
    type: CONSOLE_ISSUE_LIST_UPDATED,
    issues,
  };
}

export function shouldBroadcastConsoleIssueUpdate(
  message: unknown,
  response: unknown,
): response is ConsoleIssueListSuccessResponse {
  return (
    isConsoleIssueRequestMessage(message) &&
    message.type === SUBMIT_CONSOLE_ISSUE &&
    isConsoleIssueListResponse(response) &&
    response.ok
  );
}
