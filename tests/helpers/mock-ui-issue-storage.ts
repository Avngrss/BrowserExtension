import type { UiIssue } from '@/src/domain/ui-issue';

export function createMockUiIssueStorage(initial: UiIssue[] = []) {
  let stored: UiIssue[] = [...initial];

  return {
    getStored(): UiIssue[] {
      return stored;
    },
    read(): Promise<unknown> {
      return Promise.resolve(stored);
    },
    write(issues: UiIssue[]): Promise<void> {
      stored = [...issues];
      return Promise.resolve();
    },
    remove(): Promise<void> {
      stored = [];
      return Promise.resolve();
    },
  };
}
