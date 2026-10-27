import { describe, expect, it } from 'vitest';
import type { NetworkIssue } from '@/src/domain/network-issue';
import { NetworkIssueStore } from '@/src/network/network-issue-store';
import { MAX_STORED_NETWORK_ISSUES } from '@/src/network/network-limits';
import type { SessionSnapshot } from '@/src/domain/session';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import { createMockNetworkIssueStorage } from '../helpers/mock-network-issue-storage';

const recordingSession: SessionSnapshot = {
  status: 'recording',
  id: 'session-1',
  startedAt: 1_000,
  pausedAt: null,
  stoppedAt: null,
  ...DEFAULT_TEST_SESSION_TARGET,
};

const fetch404Payload = {
  sessionId: 'session-1',
  timestamp: 2_000,
  source: 'fetch' as const,
  category: 'http-error' as const,
  method: 'GET',
  url: 'https://example.com/api/profile',
  status: 404,
};

function createStore(session: SessionSnapshot = recordingSession) {
  let id = 0;
  const storage = createMockNetworkIssueStorage();
  const store = new NetworkIssueStore(storage, {
    getSessionState: () => session,
    createIssueId: () => `network-${++id}`,
  });
  return { store, storage };
}

describe('network issue store', () => {
  it('accepts issues only while recording from the target tab', async () => {
    const { store } = createStore();
    await store.waitUntilReady();

    await expect(
      store.submitIssue(
        fetch404Payload,
        DEFAULT_TEST_SESSION_TARGET.targetTabId,
      ),
    ).resolves.toMatchObject({ ok: true });

    await expect(store.submitIssue(fetch404Payload, 99)).resolves.toMatchObject(
      {
        ok: false,
        error: { code: 'STALE_NETWORK_ISSUE' },
      },
    );
  });

  it('deduplicates by source, category, method, url, and status', async () => {
    const { store } = createStore();
    await store.waitUntilReady();

    await store.submitIssue(
      fetch404Payload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    await store.submitIssue(
      { ...fetch404Payload, timestamp: 3_000 },
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );

    expect(store.getIssues()).toHaveLength(1);
    expect(store.getIssues()[0]?.occurrenceCount).toBe(2);
  });

  it('does not merge different methods or statuses', async () => {
    const { store } = createStore();
    await store.waitUntilReady();

    await store.submitIssue(
      fetch404Payload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    await store.submitIssue(
      {
        ...fetch404Payload,
        method: 'POST',
        timestamp: 3_000,
      },
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    await store.submitIssue(
      {
        ...fetch404Payload,
        status: 500,
        timestamp: 4_000,
      },
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );

    expect(store.getIssues()).toHaveLength(3);
  });

  it('rejects new unique issues when the limit is reached', async () => {
    const { store } = createStore();
    await store.waitUntilReady();

    for (let index = 0; index < MAX_STORED_NETWORK_ISSUES; index += 1) {
      await store.submitIssue(
        {
          ...fetch404Payload,
          url: `https://example.com/api/item-${index}`,
        },
        DEFAULT_TEST_SESSION_TARGET.targetTabId,
      );
    }

    await expect(
      store.submitIssue(
        {
          ...fetch404Payload,
          url: 'https://example.com/api/overflow',
        },
        DEFAULT_TEST_SESSION_TARGET.targetTabId,
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'NETWORK_ISSUE_LIMIT_REACHED' },
    });
  });

  it('drops malformed stored data without breaking the store', async () => {
    const storage = createMockNetworkIssueStorage();
    await storage.write([
      {
        id: 'bad',
      } as unknown as NetworkIssue,
    ]);
    const store = new NetworkIssueStore(storage, {
      getSessionState: () => recordingSession,
      createIssueId: () => 'network-1',
    });
    await store.waitUntilReady();
    expect(store.getIssues()).toEqual([]);
  });
});
