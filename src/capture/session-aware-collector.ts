import type { SessionSnapshot } from '@/src/domain/session';

export type SessionAwareCollector = {
  setTabId(tabId: number | undefined): void;
  updateSession(snapshot: SessionSnapshot): void;
};
