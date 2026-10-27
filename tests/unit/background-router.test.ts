import { describe, expect, it } from 'vitest';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import {
  handleBackgroundMessage,
  shouldBroadcastSessionUpdate,
} from '@/src/messaging/background-router';
import { START_SESSION } from '@/src/messaging/session-types';
import { InMemorySessionStore } from '@/src/sessions/in-memory-session-store';
import { createInMemorySessionBackend } from '@/src/sessions/persistent-session-store';
import { createTestActionStore } from '../helpers/test-action-store';
import { createTestConsoleIssueStore } from '../helpers/test-console-issue-store';
import { createTestNetworkIssueStore } from '../helpers/test-network-issue-store';
import {
  createTestUiIssueStore,
  createTestUiRuleStore,
} from '../helpers/test-ui-issue-store';

describe('background router', () => {
  it('handles health checks and session commands', async () => {
    const store = new InMemorySessionStore({
      createId: () => 'session-1',
      now: () => 1_000,
    });
    const backend = createInMemorySessionBackend(store);
    const actionStore = createTestActionStore(() => store.getState());
    const consoleIssueStore = createTestConsoleIssueStore(() =>
      store.getState(),
    );
    const networkIssueStore = createTestNetworkIssueStore(() =>
      store.getState(),
    );
    const uiRuleStore = createTestUiRuleStore();
    const uiIssueStore = createTestUiIssueStore(
      () => store.getState(),
      uiRuleStore,
    );

    await expect(
      handleBackgroundMessage(
        { type: 'HEALTH_CHECK' },
        backend,
        actionStore,
        consoleIssueStore,
        networkIssueStore,
        uiIssueStore,
        uiRuleStore,
        undefined,
      ),
    ).resolves.toEqual({
      status: 'ok',
      source: 'background',
    });

    await expect(
      handleBackgroundMessage(
        { type: START_SESSION },
        backend,
        actionStore,
        consoleIssueStore,
        networkIssueStore,
        uiIssueStore,
        uiRuleStore,
        undefined,
      ),
    ).resolves.toEqual({
      ok: true,
      revision: 2,
      state: {
        status: 'recording',
        id: 'session-1',
        startedAt: 1_000,
        pausedAt: null,
        stoppedAt: null,
        pageContextUpdatedAt: 1_000,
        ...DEFAULT_TEST_SESSION_TARGET,
      },
    });
  });

  it('broadcasts only successful session mutations', async () => {
    const store = new InMemorySessionStore({
      createId: () => 'session-1',
      now: () => 1_000,
    });
    const backend = createInMemorySessionBackend(store);
    const actionStore = createTestActionStore(() => store.getState());
    const consoleIssueStore = createTestConsoleIssueStore(() =>
      store.getState(),
    );
    const networkIssueStore = createTestNetworkIssueStore(() =>
      store.getState(),
    );
    const uiRuleStore = createTestUiRuleStore();
    const uiIssueStore = createTestUiIssueStore(
      () => store.getState(),
      uiRuleStore,
    );

    const startResponse = await handleBackgroundMessage(
      { type: START_SESSION },
      backend,
      actionStore,
      consoleIssueStore,
      networkIssueStore,
      uiIssueStore,
      uiRuleStore,
      undefined,
    );
    expect(
      shouldBroadcastSessionUpdate({ type: START_SESSION }, startResponse),
    ).toBe(true);

    const pauseResponse = await handleBackgroundMessage(
      { type: 'PAUSE_SESSION' },
      backend,
      actionStore,
      consoleIssueStore,
      networkIssueStore,
      uiIssueStore,
      uiRuleStore,
      undefined,
    );
    expect(
      shouldBroadcastSessionUpdate({ type: 'PAUSE_SESSION' }, pauseResponse),
    ).toBe(true);

    const idleBackend = createInMemorySessionBackend(
      new InMemorySessionStore({
        createId: () => 'session-2',
        now: () => 1_000,
      }),
    );
    const idleActionStore = createTestActionStore(() => ({ status: 'idle' }));
    const idleConsoleIssueStore = createTestConsoleIssueStore(() => ({
      status: 'idle',
    }));
    const idleNetworkIssueStore = createTestNetworkIssueStore(() => ({
      status: 'idle',
    }));
    const idleUiRuleStore = createTestUiRuleStore();
    const idleUiIssueStore = createTestUiIssueStore(
      () => ({ status: 'idle' }),
      idleUiRuleStore,
    );
    const invalidPause = await handleBackgroundMessage(
      { type: 'PAUSE_SESSION' },
      idleBackend,
      idleActionStore,
      idleConsoleIssueStore,
      idleNetworkIssueStore,
      idleUiIssueStore,
      idleUiRuleStore,
      undefined,
    );
    expect(
      shouldBroadcastSessionUpdate({ type: 'PAUSE_SESSION' }, invalidPause),
    ).toBe(false);

    expect(
      shouldBroadcastSessionUpdate(
        { type: START_SESSION },
        {
          ok: false,
          error: { code: 'STORAGE_ERROR', message: 'Save failed.' },
        },
      ),
    ).toBe(false);
  });
});
