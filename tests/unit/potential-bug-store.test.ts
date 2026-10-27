import { describe, expect, it } from 'vitest';
import type { PotentialBug } from '@/src/domain/potential-bug';
import { PotentialBugStore } from '@/src/potential-bugs/potential-bug-store';
import type { PotentialBugStorageAdapter } from '@/src/potential-bugs/potential-bug-storage';
import {
  CHECKOUT_PAGE,
  SESSION_ID,
  potentialBug,
  sequentialIds,
} from '../helpers/potential-bug-fixtures';

function memoryStorage(initial?: unknown): PotentialBugStorageAdapter & {
  stored: () => unknown;
} {
  let value: unknown = initial;
  return {
    read: () => Promise.resolve(value),
    write: (bugs: PotentialBug[]) => {
      value = structuredClone(bugs);
      return Promise.resolve();
    },
    remove: () => {
      value = undefined;
      return Promise.resolve();
    },
    stored: () => value,
  };
}

describe('PotentialBugStore', () => {
  it('persists bugs so a restarted service worker restores them', async () => {
    const storage = memoryStorage();
    const store = new PotentialBugStore(storage, sequentialIds());
    await store.recordDetectedIssue({
      sessionId: SESSION_ID,
      issue: { category: 'ui', issueId: 'u1' },
      detectedAt: 1_000,
      page: CHECKOUT_PAGE,
      actions: [],
    });

    const restarted = new PotentialBugStore(storage, sequentialIds('other'));
    await restarted.waitUntilReady();

    expect(restarted.getBugsForSession(SESSION_ID)).toHaveLength(1);
    expect(restarted.getBugs()[0]?.id).toBe('bug-1');
  });

  it('serializes concurrent detections into one grouped bug', async () => {
    const store = new PotentialBugStore(memoryStorage(), sequentialIds());
    const results = await Promise.all(
      (['ui', 'console', 'network'] as const).map((category, index) =>
        store.recordDetectedIssue({
          sessionId: SESSION_ID,
          issue: { category, issueId: `${category}-1` },
          detectedAt: 1_000 + index * 100,
          page: CHECKOUT_PAGE,
          actions: [],
        }),
      ),
    );

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(store.getBugs()).toHaveLength(1);
    expect(store.getBugs()[0]?.issues).toHaveLength(3);
  });

  it('updates status and clears everything', async () => {
    const storage = memoryStorage([potentialBug('bug-1')]);
    const store = new PotentialBugStore(storage, sequentialIds());
    await store.waitUntilReady();

    expect(await store.setStatus('bug-1', 'excluded')).toBe(true);
    expect(store.getBugs()[0]?.status).toBe('excluded');
    expect(await store.setStatus('missing', 'excluded')).toBe(false);

    await store.clear();
    expect(store.getBugs()).toEqual([]);
    expect(storage.stored()).toBeUndefined();
  });

  it('drops invalid stored data', async () => {
    const store = new PotentialBugStore(
      memoryStorage([{ id: 1 }, potentialBug('bug-ok')]),
      sequentialIds(),
    );
    await store.waitUntilReady();
    expect(store.getBugs().map((bug) => bug.id)).toEqual(['bug-ok']);
  });
});
