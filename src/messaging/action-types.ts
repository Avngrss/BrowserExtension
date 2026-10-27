import type { CapturedAction } from '@/src/domain/action';

export const SUBMIT_ACTION = 'SUBMIT_ACTION';
export const GET_ACTION_LIST = 'GET_ACTION_LIST';
export const ACTION_LIST_UPDATED = 'ACTION_LIST_UPDATED';
export const GET_CONTENT_TAB_ID = 'GET_CONTENT_TAB_ID';

export type ActionRequestType =
  typeof SUBMIT_ACTION | typeof GET_ACTION_LIST | typeof GET_CONTENT_TAB_ID;

export type SubmitActionMessage = {
  type: typeof SUBMIT_ACTION;
  action: unknown;
};

export type GetActionListMessage = {
  type: typeof GET_ACTION_LIST;
};

export type GetContentTabIdMessage = {
  type: typeof GET_CONTENT_TAB_ID;
};

export type ActionRequestMessage =
  SubmitActionMessage | GetActionListMessage | GetContentTabIdMessage;

export type ActionListUpdatedMessage = {
  type: typeof ACTION_LIST_UPDATED;
  actions: CapturedAction[];
};

export type ActionListSuccessResponse = {
  ok: true;
  actions: CapturedAction[];
};

export type ActionErrorResponse = {
  ok: false;
  error: {
    code:
      | 'STORAGE_ERROR'
      | 'ACTION_LIMIT_REACHED'
      | 'INVALID_ACTION'
      | 'STALE_ACTION'
      | 'INVALID_MESSAGE';
    message: string;
  };
};

export type ActionListResponse =
  ActionListSuccessResponse | ActionErrorResponse;

export type ContentTabIdResponse = {
  ok: true;
  tabId: number | undefined;
};
