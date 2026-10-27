import { describe, expect, it, vi } from 'vitest';
import {
  parseConsoleIssue,
  parseConsoleIssueList,
} from '@/src/console/console-issue-validation';
import { parseNetworkIssueList } from '@/src/network/network-issue-validation';
import { parseUiIssueList } from '@/src/ui/ui-issue-validation';
import { ConsoleIssueStore } from '@/src/console/console-issue-store';
import type { SessionSnapshot } from '@/src/domain/session';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import { createMockConsoleIssueStorage } from '../helpers/mock-console-issue-storage';
import {
  handleIssueDispositionRequestMessage,
  rejectInvalidIssueDispositionMessage,
} from '@/src/messaging/issue-disposition-messages';
import {
  SET_BULK_ISSUE_DISPOSITION,
  SET_ISSUE_DISPOSITION,
} from '@/src/messaging/issue-disposition-types';
import { handleBackgroundMessage } from '@/src/messaging/background-router';
import { InMemorySessionStore } from '@/src/sessions/in-memory-session-store';
import { createInMemorySessionBackend } from '@/src/sessions/persistent-session-store';
import { START_SESSION } from '@/src/messaging/session-types';
import { createTestActionStore } from '../helpers/test-action-store';
import { createTestConsoleIssueStore } from '../helpers/test-console-issue-store';
import { createTestNetworkIssueStore } from '../helpers/test-network-issue-store';
import {
  createTestUiIssueStore,
  createTestUiRuleStore,
} from '../helpers/test-ui-issue-store';

const recordingSession: SessionSnapshot = {
  status: 'recording',
  id: 'session-1',
  startedAt: 1_000,
  pausedAt: null,
  stoppedAt: null,
  ...DEFAULT_TEST_SESSION_TARGET,
};

const stoppedSession: SessionSnapshot = {
  status: 'stopped',
  id: 'session-1',
  startedAt: 1_000,
  pausedAt: null,
  stoppedAt: 5_000,
  ...DEFAULT_TEST_SESSION_TARGET,
};

const legacyConsoleIssue = {
  id: 'issue-1',
  sessionId: 'session-1',
  timestamp: 1,
  lastSeenAt: 1,
  category: 'uncaught-error' as const,
  message: 'Boom',
  url: 'https://example.com/',
  occurrenceCount: 1,
};

const issuePayload = {
  sessionId: 'session-1',
  timestamp: 2_000,
  category: 'console-error' as const,
  message: 'Failed to load user profile',
  url: 'https://example.com/checkout',
};

describe('issue disposition validation', () => {
  it('requires disposition for strict console issue parsing', () => {
    expect(parseConsoleIssue(legacyConsoleIssue)).toBeNull();
    expect(
      parseConsoleIssue({ ...legacyConsoleIssue, disposition: 'unexpected' }),
    ).not.toBeNull();
  });

  it('migrates legacy stored issues without disposition', () => {
    const parsed = parseConsoleIssueList([legacyConsoleIssue]);
    expect(parsed?.[0]?.disposition).toBe('unexpected');
  });

  it('migrates legacy UI and network stored issues', () => {
    const uiParsed = parseUiIssueList([
      {
        id: 'ui-1',
        sessionId: 'session-1',
        timestamp: 1,
        lastSeenAt: 1,
        ruleId: 'rule-1',
        ruleName: 'Alert',
        severity: 'error',
        url: 'https://example.com/',
        element: { tagName: 'div', semanticType: 'generic' },
        occurrenceCount: 1,
      },
    ]);
    expect(uiParsed?.[0]?.disposition).toBe('unexpected');

    const networkParsed = parseNetworkIssueList([
      {
        id: 'net-1',
        sessionId: 'session-1',
        timestamp: 1,
        lastSeenAt: 1,
        source: 'fetch',
        category: 'http-error',
        method: 'GET',
        url: 'https://example.com/api',
        status: 404,
        occurrenceCount: 1,
      },
    ]);
    expect(networkParsed?.[0]?.disposition).toBe('unexpected');
  });
});

describe('issue disposition store behavior', () => {
  it('defaults newly captured console issues to unexpected', async () => {
    const store = createTestConsoleIssueStore(() => recordingSession);
    await store.waitUntilReady();
    await store.submitIssue(
      issuePayload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    expect(store.getIssues()[0]?.disposition).toBe('unexpected');
  });

  it('preserves disposition when deduplicating console issues', async () => {
    const store = createTestConsoleIssueStore(() => recordingSession);
    await store.waitUntilReady();
    await store.submitIssue(
      issuePayload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    await store.setIssueDisposition(store.getIssues()[0]!.id, 'expected');
    await store.submitIssue(
      { ...issuePayload, timestamp: 3_000 },
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    const issue = store.getIssues()[0];
    expect(issue?.occurrenceCount).toBe(2);
    expect(issue?.disposition).toBe('expected');
    expect(issue?.lastSeenAt).toBe(3_000);
  });

  it('changes one issue disposition across console and network stores', async () => {
    let session: SessionSnapshot = recordingSession;
    const consoleStore = createTestConsoleIssueStore(() => session);
    const networkStore = createTestNetworkIssueStore(() => session);

    await Promise.all([
      consoleStore.waitUntilReady(),
      networkStore.waitUntilReady(),
    ]);

    await consoleStore.submitIssue(
      issuePayload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    await networkStore.submitIssue(
      {
        sessionId: 'session-1',
        timestamp: 2_000,
        source: 'fetch',
        category: 'http-error',
        method: 'GET',
        url: 'https://example.com/missing',
        status: 404,
      },
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );

    session = stoppedSession;
    const consoleId = consoleStore.getIssues()[0]!.id;
    const networkId = networkStore.getIssues()[0]!.id;

    await expect(
      consoleStore.setIssueDisposition(consoleId, 'excluded'),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      networkStore.setIssueDisposition(networkId, 'expected'),
    ).resolves.toMatchObject({ ok: true });

    expect(consoleStore.getIssues()[0]?.disposition).toBe('excluded');
    expect(networkStore.getIssues()[0]?.disposition).toBe('expected');
  });

  it('applies category and session bulk disposition updates', async () => {
    let session: SessionSnapshot = recordingSession;
    const consoleStore = createTestConsoleIssueStore(() => session);
    const networkStore = createTestNetworkIssueStore(() => session);
    await consoleStore.waitUntilReady();
    await networkStore.waitUntilReady();

    await consoleStore.submitIssue(
      issuePayload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    await consoleStore.submitIssue(
      { ...issuePayload, message: 'Another issue' },
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    await networkStore.submitIssue(
      {
        sessionId: 'session-1',
        timestamp: 2_000,
        source: 'fetch',
        category: 'http-error',
        method: 'GET',
        url: 'https://example.com/missing',
        status: 404,
      },
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );

    session = stoppedSession;

    await consoleStore.setAllIssueDispositions('expected');
    expect(
      consoleStore.getIssues().every((i) => i.disposition === 'expected'),
    ).toBe(true);
    expect(networkStore.getIssues()[0]?.disposition).toBe('unexpected');

    await networkStore.setAllIssueDispositions('expected');
    expect(networkStore.getIssues()[0]?.disposition).toBe('expected');
  });

  it('rejects disposition updates without an active session', async () => {
    const store = createTestConsoleIssueStore(() => ({ status: 'idle' }));
    await store.waitUntilReady();
    await expect(
      store.setIssueDisposition('missing', 'expected'),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'NO_ACTIVE_SESSION' },
    });
  });

  it('rejects unknown issue ids and rolls back on storage failure', async () => {
    let session: SessionSnapshot = recordingSession;
    const storage = createMockConsoleIssueStorage();
    const store = new ConsoleIssueStore(storage, {
      getSessionState: () => session,
      createIssueId: () => 'issue-1',
    });
    await store.waitUntilReady();
    await store.submitIssue(
      issuePayload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    session = stoppedSession;

    await expect(
      store.setIssueDisposition('missing-id', 'expected'),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_ISSUE_ID' },
    });

    const writeSpy = vi
      .spyOn(storage, 'write')
      .mockRejectedValueOnce(new Error('write failed'));
    await store.setIssueDisposition(store.getIssues()[0]!.id, 'expected');
    writeSpy.mockRestore();

    expect(store.getIssues()[0]?.disposition).toBe('unexpected');
  });

  it('persists disposition before returning updated issues', async () => {
    let session: SessionSnapshot = recordingSession;
    const storage = createMockConsoleIssueStorage();
    const store = new ConsoleIssueStore(storage, {
      getSessionState: () => session,
      createIssueId: () => 'issue-1',
    });
    await store.waitUntilReady();
    await store.submitIssue(
      issuePayload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    session = stoppedSession;

    let persisted: unknown;
    const writeSpy = vi.spyOn(storage, 'write').mockImplementation((issues) => {
      persisted = issues;
      return Promise.resolve();
    });

    const response = await store.setIssueDisposition(
      store.getIssues()[0]!.id,
      'expected',
    );
    writeSpy.mockRestore();

    expect(response.ok).toBe(true);
    expect(
      (persisted as { disposition: string }[] | undefined)?.[0]?.disposition,
    ).toBe('expected');
  });

  it('clears reviewed dispositions when issues are cleared for a new session', async () => {
    const store = createTestConsoleIssueStore(() => recordingSession);
    await store.waitUntilReady();
    await store.submitIssue(
      issuePayload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    await store.setIssueDisposition(store.getIssues()[0]!.id, 'expected');
    await store.clearIssues();
    expect(store.getIssues()).toEqual([]);
  });
});

describe('issue disposition messaging', () => {
  it('rejects invalid category, issue id, and disposition requests', () => {
    expect(
      rejectInvalidIssueDispositionMessage({
        type: SET_ISSUE_DISPOSITION,
        category: 'invalid',
        issueId: 'issue-1',
        disposition: 'expected',
      }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_CATEGORY' } });

    expect(
      rejectInvalidIssueDispositionMessage({
        type: SET_ISSUE_DISPOSITION,
        category: 'console',
        issueId: '',
        disposition: 'expected',
      }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_ISSUE_ID' } });

    expect(
      rejectInvalidIssueDispositionMessage({
        type: SET_ISSUE_DISPOSITION,
        category: 'console',
        issueId: 'issue-1',
        disposition: 'maybe',
      }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_DISPOSITION' } });
  });

  it('routes bulk session updates through background stores', async () => {
    const store = new InMemorySessionStore({
      createId: () => 'session-1',
      now: () => 1_000,
    });
    const backend = createInMemorySessionBackend(store);
    const actionStore = createTestActionStore(() => store.getState());
    const consoleStore = createTestConsoleIssueStore(() => store.getState());
    const networkIssueStore = createTestNetworkIssueStore(() =>
      store.getState(),
    );
    const uiRuleStore = createTestUiRuleStore();
    const uiIssueStore = createTestUiIssueStore(
      () => store.getState(),
      uiRuleStore,
    );

    await handleBackgroundMessage(
      { type: START_SESSION },
      backend,
      actionStore,
      consoleStore,
      networkIssueStore,
      uiIssueStore,
      uiRuleStore,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );

    await consoleStore.waitUntilReady();
    await consoleStore.submitIssue(
      issuePayload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );

    const response = await handleBackgroundMessage(
      {
        type: SET_BULK_ISSUE_DISPOSITION,
        category: 'all',
        disposition: 'expected',
      },
      backend,
      actionStore,
      consoleStore,
      networkIssueStore,
      uiIssueStore,
      uiRuleStore,
      undefined,
    );

    expect(response).toEqual({ ok: true });
    expect(consoleStore.getIssues()[0]?.disposition).toBe('expected');
  });

  it('handles typed disposition commands in the message handler', async () => {
    let session: SessionSnapshot = recordingSession;
    const consoleStore = createTestConsoleIssueStore(() => session);
    const networkStore = createTestNetworkIssueStore(() => stoppedSession);
    const uiStore = createTestUiIssueStore(
      () => stoppedSession,
      createTestUiRuleStore(),
    );
    await consoleStore.waitUntilReady();
    await consoleStore.submitIssue(
      issuePayload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    session = stoppedSession;
    const issueId = consoleStore.getIssues()[0]!.id;

    const result = await handleIssueDispositionRequestMessage(
      {
        type: SET_ISSUE_DISPOSITION,
        category: 'console',
        issueId,
        disposition: 'excluded',
      },
      {
        consoleIssueStore: consoleStore,
        networkIssueStore: networkStore,
        uiIssueStore: uiStore,
      },
    );

    expect(result.response).toEqual({ ok: true });
    expect(consoleStore.getIssues()[0]?.disposition).toBe('excluded');
  });
});
