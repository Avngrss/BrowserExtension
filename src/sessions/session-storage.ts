import type { SessionSnapshot } from '@/src/domain/session';
import { browser } from 'wxt/browser';

export const ACTIVE_SESSION_STORAGE_KEY = 'bugCaptureAssistant.activeSession';

export type SessionStorageAdapter = {
  read(): Promise<unknown>;
  write(snapshot: SessionSnapshot): Promise<void>;
  remove(): Promise<void>;
};

export function createBrowserSessionStorage(): SessionStorageAdapter {
  return {
    async read(): Promise<unknown> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }

      const result = await area.get(ACTIVE_SESSION_STORAGE_KEY);
      return result[ACTIVE_SESSION_STORAGE_KEY];
    },
    async write(snapshot: SessionSnapshot): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }

      await area.set({ [ACTIVE_SESSION_STORAGE_KEY]: snapshot });
    },
    async remove(): Promise<void> {
      const area = browser.storage?.session;
      if (area === undefined) {
        throw new Error('Session storage is unavailable.');
      }

      await area.remove(ACTIVE_SESSION_STORAGE_KEY);
    },
  };
}
