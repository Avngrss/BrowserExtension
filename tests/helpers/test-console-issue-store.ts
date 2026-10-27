import { ConsoleIssueStore } from '@/src/console/console-issue-store';
import type { SessionSnapshot } from '@/src/domain/session';
import { createMockConsoleIssueStorage } from './mock-console-issue-storage';

export function createTestConsoleIssueStore(
  getSessionState: () => SessionSnapshot,
) {
  let id = 0;
  return new ConsoleIssueStore(createMockConsoleIssueStorage(), {
    getSessionState,
    createIssueId: () => `issue-${++id}`,
  });
}
