import type { BugReportContext } from '@/src/domain/bug-report-context';
import { isBugReportContextResponse } from '@/src/messaging/bug-report-context-response';
import {
  BUG_REPORT_CONTEXT_UPDATED,
  GET_BUG_REPORT_CONTEXT,
  SAVE_BUG_REPORT_CONTEXT,
  type BugReportContextResponse,
} from '@/src/messaging/bug-report-context-types';
import { browser } from 'wxt/browser';

export const BUG_REPORT_CONTEXT_SYNC_FAILED_MESSAGE =
  'Could not load bug report context for this session.';

function isBugReportContextUpdatedMessage(message: unknown): message is {
  type: typeof BUG_REPORT_CONTEXT_UPDATED;
  context: BugReportContext | null;
} {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === BUG_REPORT_CONTEXT_UPDATED
  );
}

async function sendRequest(
  message: Record<string, unknown>,
): Promise<BugReportContextResponse> {
  if (typeof browser === 'undefined') {
    return {
      ok: false,
      error: {
        code: 'UNAVAILABLE',
        message: BUG_REPORT_CONTEXT_SYNC_FAILED_MESSAGE,
      },
    };
  }
  try {
    const response: unknown = await browser.runtime.sendMessage(message);
    if (!isBugReportContextResponse(response)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: BUG_REPORT_CONTEXT_SYNC_FAILED_MESSAGE,
        },
      };
    }
    return response;
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: BUG_REPORT_CONTEXT_SYNC_FAILED_MESSAGE,
      },
    };
  }
}

export const bugReportContextClient = {
  getContext(sessionId: string): Promise<BugReportContext | null> {
    return sendRequest({
      type: GET_BUG_REPORT_CONTEXT,
      sessionId,
    }).then((response) => {
      if (!response.ok) {
        throw new Error(response.error.message);
      }
      return response.context;
    });
  },
  saveContext(input: {
    sessionId: string;
    whatHappened?: string;
    whatWasExpected?: string;
  }): Promise<BugReportContext | null> {
    return sendRequest({
      type: SAVE_BUG_REPORT_CONTEXT,
      ...input,
    }).then((response) => {
      if (!response.ok) {
        throw new Error(response.error.message);
      }
      return response.context;
    });
  },
  subscribe(handler: (context: BugReportContext | null) => void): () => void {
    if (typeof browser === 'undefined') {
      return () => undefined;
    }
    const listener = (message: unknown): void => {
      if (isBugReportContextUpdatedMessage(message)) {
        handler(message.context);
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  },
};
