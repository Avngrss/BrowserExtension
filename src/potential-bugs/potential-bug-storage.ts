import type { PotentialBug } from '@/src/domain/potential-bug';
import { browser } from 'wxt/browser';

export const SESSION_POTENTIAL_BUGS_STORAGE_KEY =
  'bugCaptureAssistant.sessionPotentialBugs';

export type PotentialBugStorageAdapter = {
  read(): Promise<unknown>;
  write(bugs: PotentialBug[]): Promise<void>;
  remove(): Promise<void>;
};

function sessionArea() {
  const area = browser.storage?.session;
  if (area === undefined) {
    throw new Error('Session storage is unavailable.');
  }
  return area;
}

export function createBrowserPotentialBugStorage(): PotentialBugStorageAdapter {
  return {
    async read(): Promise<unknown> {
      const result = await sessionArea().get(
        SESSION_POTENTIAL_BUGS_STORAGE_KEY,
      );
      return result[SESSION_POTENTIAL_BUGS_STORAGE_KEY];
    },
    async write(bugs: PotentialBug[]): Promise<void> {
      await sessionArea().set({ [SESSION_POTENTIAL_BUGS_STORAGE_KEY]: bugs });
    },
    async remove(): Promise<void> {
      await sessionArea().remove(SESSION_POTENTIAL_BUGS_STORAGE_KEY);
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPotentialBug(value: unknown): value is PotentialBug {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.lastDetectedAt === 'number' &&
    (value.source === 'automatic' || value.source === 'manual') &&
    (value.status === 'included' || value.status === 'excluded') &&
    isRecord(value.page) &&
    typeof value.page.url === 'string' &&
    typeof value.page.pathname === 'string' &&
    Array.isArray(value.actions) &&
    Array.isArray(value.issues)
  );
}

export function parseStoredPotentialBugs(
  value: unknown,
): PotentialBug[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter(isPotentialBug);
}
