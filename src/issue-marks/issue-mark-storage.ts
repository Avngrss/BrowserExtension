import type { IssueMarkSessionData } from '@/src/domain/issue-mark';
import { browser } from 'wxt/browser';

export const SESSION_ISSUE_MARK_STORAGE_KEY =
  'bugCaptureAssistant.sessionIssueMark';

export type IssueMarkStorageAdapter = {
  read(): Promise<unknown>;
  write(data: IssueMarkSessionData): Promise<void>;
  remove(): Promise<void>;
};

export function createBrowserIssueMarkStorage(): IssueMarkStorageAdapter {
  return {
    async read(): Promise<unknown> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      const result = await area.get(SESSION_ISSUE_MARK_STORAGE_KEY);
      return result[SESSION_ISSUE_MARK_STORAGE_KEY];
    },
    async write(data: IssueMarkSessionData): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      await area.set({ [SESSION_ISSUE_MARK_STORAGE_KEY]: data });
    },
    async remove(): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      await area.remove(SESSION_ISSUE_MARK_STORAGE_KEY);
    },
  };
}
