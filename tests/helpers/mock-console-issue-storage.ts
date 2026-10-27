import type { ConsoleIssue } from '@/src/domain/console-issue';

export function createMockConsoleIssueStorage(initial: ConsoleIssue[] = []) {
  let stored: ConsoleIssue[] = [...initial];

  return {
    getStored(): ConsoleIssue[] {
      return stored;
    },
    read(): Promise<unknown> {
      return Promise.resolve(stored);
    },
    write(issues: ConsoleIssue[]): Promise<void> {
      stored = [...issues];
      return Promise.resolve();
    },
    remove(): Promise<void> {
      stored = [];
      return Promise.resolve();
    },
  };
}
