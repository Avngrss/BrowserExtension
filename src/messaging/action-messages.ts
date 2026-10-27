import {
  ACTION_LIST_UPDATED,
  GET_ACTION_LIST,
  GET_CONTENT_TAB_ID,
  SUBMIT_ACTION,
  type ActionListResponse,
  type ActionListSuccessResponse,
  type ActionListUpdatedMessage,
  type ActionRequestMessage,
  type ActionRequestType,
  type ContentTabIdResponse,
} from '@/src/messaging/action-types';
import type { ActionStore } from '@/src/actions/action-store';
import { parseCapturedActionList } from '@/src/actions/action-validation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const ACTION_REQUEST_TYPES: readonly ActionRequestType[] = [
  SUBMIT_ACTION,
  GET_ACTION_LIST,
  GET_CONTENT_TAB_ID,
];

function isActionRequestType(value: unknown): value is ActionRequestType {
  return (
    typeof value === 'string' &&
    ACTION_REQUEST_TYPES.some((requestType) => requestType === value)
  );
}

export function isActionRequestMessage(
  message: unknown,
): message is ActionRequestMessage {
  return isRecord(message) && isActionRequestType(message.type);
}

export function isActionListUpdatedMessage(
  message: unknown,
): message is ActionListUpdatedMessage {
  if (!isRecord(message) || message.type !== ACTION_LIST_UPDATED) {
    return false;
  }
  return parseCapturedActionList(message.actions) !== null;
}

export function isActionListResponse(
  value: unknown,
): value is ActionListResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false;
  }

  if (value.ok) {
    return parseCapturedActionList(value.actions) !== null;
  }

  return (
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

export async function handleActionRequestMessage(
  message: ActionRequestMessage,
  actionStore: ActionStore,
  senderTabId: number | undefined,
): Promise<ActionListResponse | ContentTabIdResponse | undefined> {
  if (message.type === GET_CONTENT_TAB_ID) {
    return { ok: true, tabId: senderTabId };
  }

  if (message.type === GET_ACTION_LIST) {
    return actionStore.getActionList();
  }

  if (message.type === SUBMIT_ACTION) {
    return actionStore.submitAction(message.action, senderTabId);
  }

  return undefined;
}

export function createActionListUpdatedMessage(
  actions: ActionListUpdatedMessage['actions'],
): ActionListUpdatedMessage {
  return {
    type: ACTION_LIST_UPDATED,
    actions,
  };
}

export function shouldBroadcastActionUpdate(
  message: unknown,
  response: unknown,
): response is ActionListSuccessResponse {
  return (
    isActionRequestMessage(message) &&
    message.type === SUBMIT_ACTION &&
    isActionListResponse(response) &&
    response.ok
  );
}
