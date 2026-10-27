import type { UiIssue } from '@/src/domain/ui-issue';
import {
  GET_UI_ISSUE_LIST,
  type UiIssueListResponse,
} from '@/src/messaging/ui-issue-types';
import {
  isUiIssueListResponse,
  isUiIssueListUpdatedMessage,
} from '@/src/messaging/ui-issue-messages';
import { browser } from 'wxt/browser';

export const UI_ISSUE_SYNC_FAILED_MESSAGE =
  'Could not load captured UI issues for this session.';

async function sendUiIssueRequest(): Promise<UiIssueListResponse> {
  if (typeof browser === 'undefined') {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: UI_ISSUE_SYNC_FAILED_MESSAGE,
      },
    };
  }

  try {
    const response: unknown = await browser.runtime.sendMessage({
      type: GET_UI_ISSUE_LIST,
    });
    if (!isUiIssueListResponse(response)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: UI_ISSUE_SYNC_FAILED_MESSAGE,
        },
      };
    }
    return response;
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: UI_ISSUE_SYNC_FAILED_MESSAGE,
      },
    };
  }
}

export const uiIssueClient = {
  getIssues(): Promise<UiIssueListResponse> {
    return sendUiIssueRequest();
  },
  subscribe(onIssues: (issues: UiIssue[]) => void): () => void {
    if (typeof browser === 'undefined') {
      return () => undefined;
    }

    const listener = (message: unknown): void => {
      if (isUiIssueListUpdatedMessage(message)) {
        onIssues(message.issues);
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  },
};
