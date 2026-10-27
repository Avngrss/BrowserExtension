import { describe, expect, it } from 'vitest';
import {
  ConsoleIssueStore,
  MAX_STORED_CONSOLE_ISSUES,
} from '@/src/console/console-issue-store';
import type { SessionSnapshot } from '@/src/domain/session';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import { createMockConsoleIssueStorage } from '../helpers/mock-console-issue-storage';

const recordingSession: SessionSnapshot = {
  status: 'recording',
  id: 'session-1',
  startedAt: 1_000,
  pausedAt: null,
  stoppedAt: null,
  ...DEFAULT_TEST_SESSION_TARGET,
};

const issuePayload = {
  sessionId: 'session-1',
  timestamp: 2_000,
  category: 'console-error' as const,
  message: 'Failed to load user profile',
  url: 'https://example.com/checkout',
};

function createStore(session: SessionSnapshot = recordingSession) {
  let id = 0;
  const storage = createMockConsoleIssueStorage();
  const store = new ConsoleIssueStore(storage, {
    getSessionState: () => session,
    createIssueId: () => `issue-${++id}`,
  });
  return { store, storage };
}

describe('console issue store', () => {
  it('accepts issues only while recording from the target tab', async () => {
    const { store } = createStore();
    await store.waitUntilReady();

    await expect(
      store.submitIssue(issuePayload, DEFAULT_TEST_SESSION_TARGET.targetTabId),
    ).resolves.toMatchObject({ ok: true });

    await expect(store.submitIssue(issuePayload, 99)).resolves.toMatchObject({
      ok: false,
      error: { code: 'STALE_CONSOLE_ISSUE' },
    });
  });

  it('deduplicates equivalent issues and increments occurrence count', async () => {
    const { store } = createStore();
    await store.waitUntilReady();

    await store.submitIssue(
      issuePayload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    await store.submitIssue(
      { ...issuePayload, timestamp: 3_000 },
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );

    expect(store.getIssues()).toHaveLength(1);
    expect(store.getIssues()[0]?.occurrenceCount).toBe(2);
    expect(store.getIssues()[0]?.lastSeenAt).toBe(3_000);
  });

  it('rejects new unique issues when the limit is reached', async () => {
    const { store } = createStore();
    await store.waitUntilReady();

    for (let index = 0; index < MAX_STORED_CONSOLE_ISSUES; index += 1) {
      await store.submitIssue(
        {
          ...issuePayload,
          message: `Issue ${index}`,
        },
        DEFAULT_TEST_SESSION_TARGET.targetTabId,
      );
    }

    await expect(
      store.submitIssue(
        { ...issuePayload, message: 'One more issue' },
        DEFAULT_TEST_SESSION_TARGET.targetTabId,
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'CONSOLE_ISSUE_LIMIT_REACHED' },
    });

    await store.submitIssue(
      { ...issuePayload, message: 'Issue 0' },
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    expect(store.getIssues()[0]?.occurrenceCount).toBe(2);
  });

  it('clears issues on demand and restores valid persisted issues', async () => {
    const storage = createMockConsoleIssueStorage();
    const first = new ConsoleIssueStore(storage, {
      getSessionState: () => recordingSession,
      createIssueId: () => 'issue-1',
    });
    await first.waitUntilReady();
    await first.submitIssue(
      issuePayload,
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );
    await first.clearIssues();
    expect(first.getIssues()).toEqual([]);

    await storage.write([
      {
        id: 'issue-1',
        sessionId: 'session-1',
        timestamp: 1,
        lastSeenAt: 1,
        category: 'uncaught-error',
        message: 'Boom',
        url: 'https://example.com/',
        occurrenceCount: 1,
      },
    ] as unknown as Parameters<typeof storage.write>[0]);
    const restored = new ConsoleIssueStore(storage, {
      getSessionState: () => recordingSession,
      createIssueId: () => 'issue-2',
    });
    await restored.waitUntilReady();
    expect(restored.getIssues()).toHaveLength(1);
    expect(restored.getIssues()[0]?.disposition).toBe('unexpected');
  });

  it('drops malformed persisted issues', async () => {
    const storage = createMockConsoleIssueStorage();
    await storage.write([{ invalid: true }] as unknown as Parameters<
      typeof storage.write
    >[0]);
    const store = new ConsoleIssueStore(storage, {
      getSessionState: () => recordingSession,
      createIssueId: () => 'issue-1',
    });
    await store.waitUntilReady();
    expect(store.getIssues()).toEqual([]);
  });
});
