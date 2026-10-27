import { describe, expect, it } from 'vitest';
import { IssueMarkStore } from '@/src/issue-marks/issue-mark-store';
import type { IssueMarkStorageAdapter } from '@/src/issue-marks/issue-mark-storage';

function createMemoryIssueMarkStorage(): IssueMarkStorageAdapter {
  let value: unknown;
  return {
    read: () => Promise.resolve(value),
    write: (data) => {
      value = data;
      return Promise.resolve();
    },
    remove: () => {
      value = undefined;
      return Promise.resolve();
    },
  };
}

describe('IssueMarkStore', () => {
  it('persists and clears a mark', async () => {
    const store = new IssueMarkStore(createMemoryIssueMarkStorage());
    await store.waitUntilReady();
    await store.saveMark({
      sessionId: 's1',
      markedAt: 100,
      pageUrl: 'https://example.test/',
      pathname: '/',
      actionIds: ['a1'],
      relatedIssues: [],
      reportScope: 'around-mark',
      note: 'Broken checkout',
    });
    expect(store.getMarkForSession('s1')?.note).toBe('Broken checkout');
    await store.clear();
    expect(store.getMarkForSession('s1')).toBeNull();
  });

  it('updates report scope without mark', async () => {
    const store = new IssueMarkStore(createMemoryIssueMarkStorage());
    await store.waitUntilReady();
    await store.setReportScopeWithoutMark('full-session');
    expect(store.getReportScopeWithoutMark()).toBe('full-session');
  });
});
