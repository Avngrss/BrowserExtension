import type { NetworkIssue } from '@/src/domain/network-issue';
import { browser } from 'wxt/browser';

export const SESSION_NETWORK_ISSUES_STORAGE_KEY =
  'bugCaptureAssistant.networkIssues';

export type NetworkIssueStorageAdapter = {
  read(): Promise<unknown>;
  write(issues: NetworkIssue[]): Promise<void>;
  remove(): Promise<void>;
};

export function createBrowserNetworkIssueStorage(): NetworkIssueStorageAdapter {
  return {
    async read(): Promise<unknown> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      const result = await area.get(SESSION_NETWORK_ISSUES_STORAGE_KEY);
      return result[SESSION_NETWORK_ISSUES_STORAGE_KEY];
    },
    async write(issues: NetworkIssue[]): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      await area.set({ [SESSION_NETWORK_ISSUES_STORAGE_KEY]: issues });
    },
    async remove(): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      await area.remove(SESSION_NETWORK_ISSUES_STORAGE_KEY);
    },
  };
}
