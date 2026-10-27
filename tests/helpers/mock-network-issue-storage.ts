import type { NetworkIssue } from '@/src/domain/network-issue';

export function createMockNetworkIssueStorage(initial: NetworkIssue[] = []) {
  let stored: NetworkIssue[] = [...initial];

  return {
    getStored(): NetworkIssue[] {
      return stored;
    },
    read(): Promise<unknown> {
      return Promise.resolve(stored);
    },
    write(issues: NetworkIssue[]): Promise<void> {
      stored = [...issues];
      return Promise.resolve();
    },
    remove(): Promise<void> {
      stored = [];
      return Promise.resolve();
    },
  };
}
