import type { IssueMarkSessionData } from '@/src/domain/issue-mark';
import {
  GET_ISSUE_MARK,
  ISSUE_MARK_UPDATED,
  SAVE_ISSUE_MARK,
  SET_ISSUE_MARK_REPORT_SCOPE,
  SET_REPORT_SCOPE_WITHOUT_MARK,
  type IssueMarkResponse,
} from '@/src/messaging/issue-mark-types';
import { browser } from 'wxt/browser';

export const ISSUE_MARK_SYNC_FAILED_MESSAGE =
  'Could not load the marked issue for this session.';

export const ISSUE_MARK_SAVE_FAILED_MESSAGE = 'Could not save the issue mark.';

async function sendIssueMarkMessage(
  message: Record<string, unknown>,
): Promise<IssueMarkResponse> {
  const response: unknown = await browser.runtime.sendMessage(message);
  if (
    typeof response === 'object' &&
    response !== null &&
    'ok' in response &&
    response.ok === true &&
    'data' in response
  ) {
    return response as { ok: true; data: IssueMarkSessionData };
  }
  if (
    typeof response === 'object' &&
    response !== null &&
    'ok' in response &&
    response.ok === false &&
    'error' in response
  ) {
    return response as IssueMarkResponse;
  }
  throw new Error(ISSUE_MARK_SAVE_FAILED_MESSAGE);
}

export const issueMarkClient = {
  async getData(): Promise<IssueMarkSessionData> {
    const response = await sendIssueMarkMessage({ type: GET_ISSUE_MARK });
    if (!response.ok) {
      throw new Error(ISSUE_MARK_SYNC_FAILED_MESSAGE);
    }
    return response.data;
  },

  async saveMark(input: {
    note?: string;
    replaceExisting: boolean;
  }): Promise<IssueMarkResponse> {
    return sendIssueMarkMessage({
      type: SAVE_ISSUE_MARK,
      note: input.note,
      replaceExisting: input.replaceExisting,
    });
  },

  async setReportScope(
    scope: import('@/src/domain/issue-mark').IssueMarkReportScope,
  ): Promise<IssueMarkSessionData> {
    const response = await sendIssueMarkMessage({
      type: SET_ISSUE_MARK_REPORT_SCOPE,
      scope,
    });
    if (!response.ok) {
      throw new Error(ISSUE_MARK_SAVE_FAILED_MESSAGE);
    }
    return response.data;
  },

  async setReportScopeWithoutMark(
    scope: import('@/src/domain/issue-mark').IssueMarkReportScopeWithoutMark,
  ): Promise<IssueMarkSessionData> {
    const response = await sendIssueMarkMessage({
      type: SET_REPORT_SCOPE_WITHOUT_MARK,
      scope,
    });
    if (!response.ok) {
      throw new Error(ISSUE_MARK_SAVE_FAILED_MESSAGE);
    }
    return response.data;
  },

  subscribe(listener: (data: IssueMarkSessionData) => void): () => void {
    const handler = (message: unknown): void => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        (message as Record<string, unknown>).type === ISSUE_MARK_UPDATED &&
        'data' in message
      ) {
        listener((message as { data: IssueMarkSessionData }).data);
      }
    };
    browser.runtime.onMessage.addListener(handler);
    return () => {
      browser.runtime.onMessage.removeListener(handler);
    };
  },
};
