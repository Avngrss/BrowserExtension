import { ActionStore } from '@/src/actions/action-store';
import type { SessionSnapshot } from '@/src/domain/session';
import { createMockActionStorage } from './mock-action-storage';

export function createTestActionStore(
  getSessionState: () => SessionSnapshot,
): ActionStore {
  return new ActionStore(createMockActionStorage(), {
    getSessionState,
    createActionId: () => 'action-1',
  });
}
