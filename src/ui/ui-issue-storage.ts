import type { UiIssue } from '@/src/domain/ui-issue';
import { browser } from 'wxt/browser';

export const SESSION_UI_ISSUES_STORAGE_KEY = 'bugCaptureAssistant.uiIssues';

export type UiIssueStorageAdapter = {
  read(): Promise<unknown>;
  write(issues: UiIssue[]): Promise<void>;
  remove(): Promise<void>;
};

export function createBrowserUiIssueStorage(): UiIssueStorageAdapter {
  return {
    async read(): Promise<unknown> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      const result = await area.get(SESSION_UI_ISSUES_STORAGE_KEY);
      return result[SESSION_UI_ISSUES_STORAGE_KEY];
    },
    async write(issues: UiIssue[]): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      await area.set({ [SESSION_UI_ISSUES_STORAGE_KEY]: issues });
    },
    async remove(): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      await area.remove(SESSION_UI_ISSUES_STORAGE_KEY);
    },
  };
}
