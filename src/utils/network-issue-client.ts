import type { NetworkIssue } from '@/src/domain/network-issue';
import {
  GET_NETWORK_ISSUE_LIST,
  type NetworkIssueListResponse,
} from '@/src/messaging/network-issue-types';
import {
  isNetworkIssueListResponse,
  isNetworkIssueListUpdatedMessage,
} from '@/src/messaging/network-issue-messages';
import { browser } from 'wxt/browser';

export const NETWORK_ISSUE_SYNC_FAILED_MESSAGE =
  'Could not load captured network issues for this session.';

async function sendNetworkIssueRequest(): Promise<NetworkIssueListResponse> {
  if (typeof browser === 'undefined') {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: NETWORK_ISSUE_SYNC_FAILED_MESSAGE,
      },
    };
  }

  try {
    const response: unknown = await browser.runtime.sendMessage({
      type: GET_NETWORK_ISSUE_LIST,
    });
    if (!isNetworkIssueListResponse(response)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: NETWORK_ISSUE_SYNC_FAILED_MESSAGE,
        },
      };
    }
    return response;
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: NETWORK_ISSUE_SYNC_FAILED_MESSAGE,
      },
    };
  }
}

export const networkIssueClient = {
  getIssues(): Promise<NetworkIssueListResponse> {
    return sendNetworkIssueRequest();
  },
  subscribe(onIssues: (issues: NetworkIssue[]) => void): () => void {
    if (typeof browser === 'undefined') {
      return () => undefined;
    }

    const listener = (message: unknown): void => {
      if (isNetworkIssueListUpdatedMessage(message)) {
        onIssues(message.issues);
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  },
};
