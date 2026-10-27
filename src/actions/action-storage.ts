import type { CapturedAction } from '@/src/domain/action';
import { browser } from 'wxt/browser';

export const SESSION_ACTIONS_STORAGE_KEY = 'bugCaptureAssistant.sessionActions';

export type ActionStorageAdapter = {
  read(): Promise<unknown>;
  write(actions: CapturedAction[]): Promise<void>;
  remove(): Promise<void>;
};

export function createBrowserActionStorage(): ActionStorageAdapter {
  return {
    async read(): Promise<unknown> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      const result = await area.get(SESSION_ACTIONS_STORAGE_KEY);
      return result[SESSION_ACTIONS_STORAGE_KEY];
    },
    async write(actions: CapturedAction[]): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      await area.set({ [SESSION_ACTIONS_STORAGE_KEY]: actions });
    },
    async remove(): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }
      await area.remove(SESSION_ACTIONS_STORAGE_KEY);
    },
  };
}
