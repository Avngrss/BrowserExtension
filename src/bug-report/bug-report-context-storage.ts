import type { BugReportContext } from '@/src/domain/bug-report-context';
import { browser } from 'wxt/browser';

export const SESSION_BUG_REPORT_CONTEXT_STORAGE_KEY =
  'bugCaptureAssistant.sessionBugReportContext';

export type BugReportContextStorageAdapter = {
  read(): Promise<unknown>;
  write(data: BugReportContext): Promise<void>;
  remove(): Promise<void>;
};

export function createBrowserBugReportContextStorage(): BugReportContextStorageAdapter {
  return {
    async read(): Promise<unknown> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      const result = await area.get(SESSION_BUG_REPORT_CONTEXT_STORAGE_KEY);
      return result[SESSION_BUG_REPORT_CONTEXT_STORAGE_KEY];
    },
    async write(data: BugReportContext): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      await area.set({ [SESSION_BUG_REPORT_CONTEXT_STORAGE_KEY]: data });
    },
    async remove(): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      await area.remove(SESSION_BUG_REPORT_CONTEXT_STORAGE_KEY);
    },
  };
}
