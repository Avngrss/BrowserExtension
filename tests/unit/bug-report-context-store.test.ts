import { describe, expect, it } from 'vitest';
import { BugReportContextStore } from '@/src/bug-report/bug-report-context-store';

describe('BugReportContextStore', () => {
  it('persists and clears context for a session', async () => {
    let stored: unknown;
    const store = new BugReportContextStore({
      read: () => Promise.resolve(stored),
      write: (data) => {
        stored = data;
        return Promise.resolve();
      },
      remove: () => {
        stored = undefined;
        return Promise.resolve();
      },
    });
    await store.waitUntilReady();

    await store.saveContext({
      sessionId: 'session-1',
      whatHappened: 'Button stuck',
      whatWasExpected: 'Cart opens',
    });
    expect(store.getContextForSession('session-1')).toEqual({
      sessionId: 'session-1',
      whatHappened: 'Button stuck',
      whatWasExpected: 'Cart opens',
    });

    await store.clear();
    expect(store.getContextForSession('session-1')).toBeNull();
  });
});
