import type { ConsoleIssue } from '@/src/domain/console-issue';
import {
  GET_CONSOLE_ISSUE_LIST,
  type ConsoleIssueListResponse,
} from '@/src/messaging/console-issue-types';
import {
  isConsoleIssueListResponse,
  isConsoleIssueListUpdatedMessage,
} from '@/src/messaging/console-issue-messages';
import { browser } from 'wxt/browser';

export const CONSOLE_ISSUE_SYNC_FAILED_MESSAGE =
  'Could not load captured console issues for this session.';

async function sendConsoleIssueRequest(): Promise<ConsoleIssueListResponse> {
  if (typeof browser === 'undefined') {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: CONSOLE_ISSUE_SYNC_FAILED_MESSAGE,
      },
    };
  }

  try {
    const response: unknown = await browser.runtime.sendMessage({
      type: GET_CONSOLE_ISSUE_LIST,
    });
    if (!isConsoleIssueListResponse(response)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: CONSOLE_ISSUE_SYNC_FAILED_MESSAGE,
        },
      };
    }
    return response;
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: CONSOLE_ISSUE_SYNC_FAILED_MESSAGE,
      },
    };
  }
}

export const consoleIssueClient = {
  getIssues(): Promise<ConsoleIssueListResponse> {
    return sendConsoleIssueRequest();
  },
  subscribe(onIssues: (issues: ConsoleIssue[]) => void): () => void {
    if (typeof browser === 'undefined') {
      return () => undefined;
    }

    const listener = (message: unknown): void => {
      if (isConsoleIssueListUpdatedMessage(message)) {
        onIssues(message.issues);
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  },
};
