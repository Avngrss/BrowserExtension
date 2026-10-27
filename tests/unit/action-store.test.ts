import { describe, expect, it } from 'vitest';
import { ActionStore, MAX_STORED_ACTIONS } from '@/src/actions/action-store';
import type { SessionSnapshot } from '@/src/domain/session';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import { createMockActionStorage } from '../helpers/mock-action-storage';

const recordingSession: SessionSnapshot = {
  status: 'recording',
  id: 'session-1',
  startedAt: 1_000,
  pausedAt: null,
  stoppedAt: null,
  ...DEFAULT_TEST_SESSION_TARGET,
};

function createStore(session: SessionSnapshot = recordingSession) {
  let id = 0;
  const storage = createMockActionStorage();
  const store = new ActionStore(storage, {
    getSessionState: () => session,
    createActionId: () => `action-${++id}`,
  });
  return { store, storage };
}

const clickPayload = {
  type: 'click' as const,
  sessionId: 'session-1',
  timestamp: 2_000,
  url: 'https://example.com/',
  element: { tagName: 'button', visibleText: 'Save' },
};

describe('action store', () => {
  it('accepts actions only while recording from the target tab', async () => {
    const { store } = createStore();
    await store.waitUntilReady();

    await expect(
      store.submitAction(clickPayload, DEFAULT_TEST_SESSION_TARGET.targetTabId),
    ).resolves.toMatchObject({ ok: true });

    await expect(store.submitAction(clickPayload, 99)).resolves.toEqual({
      ok: false,
      error: {
        code: 'STALE_ACTION',
        message: 'Actions are only accepted from the monitored tab.',
      },
    });
  });

  it('rejects actions while paused', async () => {
    const pausedSession = {
      status: 'paused' as const,
      id: 'session-1',
      startedAt: 1_000,
      pausedAt: 1_500,
      stoppedAt: null,
      ...DEFAULT_TEST_SESSION_TARGET,
    };
    const { store } = createStore(pausedSession);
    await store.waitUntilReady();

    await expect(
      store.submitAction(clickPayload, DEFAULT_TEST_SESSION_TARGET.targetTabId),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'STALE_ACTION' },
    });
  });

  it('persists and restores actions', async () => {
    const storage = createMockActionStorage();
    const first = new ActionStore(storage, {
      getSessionState: () => recordingSession,
      createActionId: () => 'action-1',
    });
    await first.waitUntilReady();
    await first.submitAction(
      clickPayload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );

    const restored = new ActionStore(storage, {
      getSessionState: () => recordingSession,
      createActionId: () => 'action-2',
    });
    await restored.waitUntilReady();
    expect(restored.getActions()).toHaveLength(1);
  });

  it('clears malformed stored actions during restoration', async () => {
    const storage = createMockActionStorage();
    storage.read = () => Promise.resolve([{ invalid: true }]);
    const store = new ActionStore(storage, {
      getSessionState: () => recordingSession,
      createActionId: () => 'action-1',
    });
    await store.waitUntilReady();
    expect(store.getActions()).toEqual([]);
  });

  it('enforces the hard action limit', async () => {
    const { store } = createStore();
    await store.waitUntilReady();

    for (let index = 0; index < MAX_STORED_ACTIONS; index += 1) {
      await store.submitAction(
        { ...clickPayload, timestamp: 2_000 + index },
        DEFAULT_TEST_SESSION_TARGET.targetTabId,
      );
    }

    const limited = await store.submitAction(
      { ...clickPayload, timestamp: 9_999 },
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    expect(limited).toEqual({
      ok: false,
      error: {
        code: 'ACTION_LIMIT_REACHED',
        message: 'The action limit for this session has been reached.',
      },
    });
    expect(store.getActions()).toHaveLength(MAX_STORED_ACTIONS);
  });

  it('rolls back memory when persistence fails', async () => {
    const storage = createMockActionStorage();
    storage.write = () => Promise.reject(new Error('write failed'));
    const store = new ActionStore(storage, {
      getSessionState: () => recordingSession,
      createActionId: () => 'action-1',
    });
    await store.waitUntilReady();

    await expect(
      store.submitAction(clickPayload, DEFAULT_TEST_SESSION_TARGET.targetTabId),
    ).resolves.toMatchObject({ ok: false, error: { code: 'STORAGE_ERROR' } });
    expect(store.getActions()).toHaveLength(0);
  });
});
