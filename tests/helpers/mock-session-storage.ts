import type { SessionSnapshot } from '@/src/domain/session';
import { ACTIVE_SESSION_STORAGE_KEY } from '@/src/sessions/session-storage';
import type { SessionStorageAdapter } from '@/src/sessions/session-storage';

type MockSessionStorageOptions = {
  readError?: Error;
  writeError?: Error;
  removeError?: Error;
};

export function createMockSessionStorage(
  initial?: SessionSnapshot,
  options: MockSessionStorageOptions = {},
): SessionStorageAdapter & {
  getStored(): SessionSnapshot | undefined;
  setStored(value: SessionSnapshot | undefined): void;
} {
  let stored: SessionSnapshot | undefined = initial;

  return {
    getStored(): SessionSnapshot | undefined {
      return stored;
    },
    setStored(value: SessionSnapshot | undefined): void {
      stored = value;
    },
    read(): Promise<unknown> {
      if (options.readError) {
        return Promise.reject(options.readError);
      }
      return Promise.resolve(stored);
    },
    write(snapshot: SessionSnapshot): Promise<void> {
      if (options.writeError) {
        return Promise.reject(options.writeError);
      }
      stored = snapshot;
      return Promise.resolve();
    },
    remove(): Promise<void> {
      if (options.removeError) {
        return Promise.reject(options.removeError);
      }
      stored = undefined;
      return Promise.resolve();
    },
  };
}

export { ACTIVE_SESSION_STORAGE_KEY };
