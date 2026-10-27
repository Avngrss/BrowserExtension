import { describe, expect, it } from 'vitest';
import { ActionStore } from '@/src/actions/action-store';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import { InMemorySessionStore } from '@/src/sessions/in-memory-session-store';
import { PersistentSessionStore } from '@/src/sessions/persistent-session-store';
import { NO_SUPPORTED_TARGET_TAB_MESSAGE } from '@/src/sessions/session-tab-resolver';
import { createMockActionStorage } from '../helpers/mock-action-storage';
import { createMockSessionStorage } from '../helpers/mock-session-storage';

function mockTabResolver(
  binding: typeof DEFAULT_TEST_SESSION_TARGET = DEFAULT_TEST_SESSION_TARGET,
) {
  return {
    resolveActiveHttpTab: () => Promise.resolve({ ok: true as const, binding }),
    resolveHttpTab: () => Promise.resolve({ ok: true as const, binding }),
  };
}

describe('session start binding', () => {
  it('binds the active HTTP tab when starting', async () => {
    const memory = new InMemorySessionStore({
      createId: () => 'session-1',
      now: () => 1_000,
    });
    const persistent = new PersistentSessionStore(
      memory,
      createMockSessionStorage(),
      {
        tabResolver: mockTabResolver(),
      },
    );
    await persistent.waitUntilReady();

    const response = await persistent.runSessionCommand('start');
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.state).toMatchObject(DEFAULT_TEST_SESSION_TARGET);
    }
  });

  it('rejects unsupported target tabs without starting', async () => {
    const memory = new InMemorySessionStore({
      createId: () => 'session-1',
      now: () => 1_000,
    });
    const persistent = new PersistentSessionStore(
      memory,
      createMockSessionStorage(),
      {
        tabResolver: {
          resolveActiveHttpTab: () =>
            Promise.resolve({
              ok: false as const,
              message: NO_SUPPORTED_TARGET_TAB_MESSAGE,
            }),
          resolveHttpTab: () =>
            Promise.resolve({
              ok: false as const,
              message: NO_SUPPORTED_TARGET_TAB_MESSAGE,
            }),
        },
      },
    );
    await persistent.waitUntilReady();

    expect(await persistent.runSessionCommand('start')).toEqual({
      ok: false,
      error: {
        code: 'NO_SUPPORTED_TARGET_TAB',
        message: NO_SUPPORTED_TARGET_TAB_MESSAGE,
      },
    });
    expect(memory.getState()).toEqual({ status: 'idle' });
  });

  it('clears previous actions when a new session starts', async () => {
    const memory = new InMemorySessionStore({
      createId: () => 'session-1',
      now: () => 1_000,
    });
    const actionStorage = createMockActionStorage([
      {
        id: 'action-old',
        type: 'click',
        sessionId: 'old',
        timestamp: 1,
        url: 'https://example.com/',
        element: { tagName: 'button' },
      },
    ]);
    const actionStore = new ActionStore(actionStorage, {
      getSessionState: () => memory.getState(),
      createActionId: () => 'action-new',
    });
    const persistent = new PersistentSessionStore(
      memory,
      createMockSessionStorage(),
      {
        tabResolver: mockTabResolver(),
        onSessionStarted: () => actionStore.clearActions(),
      },
    );
    await persistent.waitUntilReady();
    await actionStore.waitUntilReady();
    expect(actionStore.getActions()).toHaveLength(1);

    await persistent.runSessionCommand('start');
    expect(actionStore.getActions()).toHaveLength(0);
  });
});
