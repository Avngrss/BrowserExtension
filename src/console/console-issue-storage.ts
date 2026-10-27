import type { ConsoleIssue } from '@/src/domain/console-issue';
import { browser } from 'wxt/browser';

export const SESSION_CONSOLE_ISSUES_STORAGE_KEY =
  'bugCaptureAssistant.consoleIssues';

export type ConsoleIssueStorageAdapter = {
  read(): Promise<unknown>;
  write(issues: ConsoleIssue[]): Promise<void>;
  remove(): Promise<void>;
};

export function createBrowserConsoleIssueStorage(): ConsoleIssueStorageAdapter {
  return {
    async read(): Promise<unknown> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      const result = await area.get(SESSION_CONSOLE_ISSUES_STORAGE_KEY);
      return result[SESSION_CONSOLE_ISSUES_STORAGE_KEY];
    },
    async write(issues: ConsoleIssue[]): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      await area.set({ [SESSION_CONSOLE_ISSUES_STORAGE_KEY]: issues });
    },
    async remove(): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      await area.remove(SESSION_CONSOLE_ISSUES_STORAGE_KEY);
    },
  };
}
