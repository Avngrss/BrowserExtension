import type { CapturedAction } from '@/src/domain/action';

export function createMockActionStorage(initial: CapturedAction[] = []) {
  let stored: CapturedAction[] = [...initial];

  return {
    getStored(): CapturedAction[] {
      return stored;
    },
    read(): Promise<unknown> {
      return Promise.resolve(stored);
    },
    write(actions: CapturedAction[]): Promise<void> {
      stored = [...actions];
      return Promise.resolve();
    },
    remove(): Promise<void> {
      stored = [];
      return Promise.resolve();
    },
  };
}
