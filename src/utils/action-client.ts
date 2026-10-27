import type { CapturedAction } from '@/src/domain/action';
import {
  GET_ACTION_LIST,
  type ActionListResponse,
} from '@/src/messaging/action-types';
import {
  isActionListResponse,
  isActionListUpdatedMessage,
} from '@/src/messaging/action-messages';
import { browser } from 'wxt/browser';

export const ACTION_SYNC_FAILED_MESSAGE =
  'Could not load captured actions for this session.';

async function sendActionRequest(): Promise<ActionListResponse> {
  if (typeof browser === 'undefined') {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: ACTION_SYNC_FAILED_MESSAGE,
      },
    };
  }

  try {
    const response: unknown = await browser.runtime.sendMessage({
      type: GET_ACTION_LIST,
    });
    if (!isActionListResponse(response)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: ACTION_SYNC_FAILED_MESSAGE,
        },
      };
    }
    return response;
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: ACTION_SYNC_FAILED_MESSAGE,
      },
    };
  }
}

export const actionClient = {
  getActions(): Promise<ActionListResponse> {
    return sendActionRequest();
  },
  subscribe(onActions: (actions: CapturedAction[]) => void): () => void {
    if (typeof browser === 'undefined') {
      return () => undefined;
    }

    const listener = (message: unknown): void => {
      if (isActionListUpdatedMessage(message)) {
        onActions(message.actions);
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  },
};
