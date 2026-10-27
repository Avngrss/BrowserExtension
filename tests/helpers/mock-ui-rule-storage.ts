import type { UiIssueRule } from '@/src/domain/ui-rule';

export function createMockUiRuleStorage(initial: UiIssueRule[] = []) {
  let stored: UiIssueRule[] = [...initial];

  return {
    getStored(): UiIssueRule[] {
      return stored;
    },
    read(): Promise<unknown> {
      return Promise.resolve(stored);
    },
    write(rules: UiIssueRule[]): Promise<void> {
      stored = [...rules];
      return Promise.resolve();
    },
  };
}
