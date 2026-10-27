import { NetworkIssueStore } from '@/src/network/network-issue-store';
import type { SessionSnapshot } from '@/src/domain/session';
import { createMockNetworkIssueStorage } from './mock-network-issue-storage';

export function createTestNetworkIssueStore(
  getSessionState: () => SessionSnapshot,
) {
  let id = 0;
  return new NetworkIssueStore(createMockNetworkIssueStorage(), {
    getSessionState,
    createIssueId: () => `network-${++id}`,
  });
}
