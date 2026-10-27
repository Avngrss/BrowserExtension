import { describe, expect, it } from 'vitest';
import type { SessionSnapshot } from '@/src/domain/session';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
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

describe('UiIssueStore', () => {
  it('accepts issues only while recording on the target tab', async () => {
    const ruleStore = createTestUiRuleStore();
    await ruleStore.waitUntilReady();
    const store = createTestUiIssueStore(() => recordingSession, ruleStore);
    await store.waitUntilReady();

    await expect(
      store.submitIssue(
        {
          sessionId: 'session-1',
          timestamp: 2_000,
          ruleId: 'rule-1',
          ruleName: 'Alert role',
          severity: 'error',
          url: 'https://example.com/checkout',
          element: { tagName: 'div', role: 'alert' },
          visibleMessage: 'Email is required',
        },
        DEFAULT_TEST_SESSION_TARGET.targetTabId,
      ),
    ).resolves.toMatchObject({ ok: true });
  });

  it('deduplicates equivalent UI issues', async () => {
    const ruleStore = createTestUiRuleStore();
    await ruleStore.waitUntilReady();
    const store = createTestUiIssueStore(() => recordingSession, ruleStore);
    await store.waitUntilReady();

    const payload = {
      sessionId: 'session-1',
      timestamp: 2_000,
      ruleId: 'rule-1',
      ruleName: 'Alert role',
      severity: 'error' as const,
      url: 'https://example.com/checkout',
      element: { tagName: 'div', role: 'alert', accessibleName: 'Email' },
      visibleMessage: 'Email is required',
    };

    await store.submitIssue(payload, DEFAULT_TEST_SESSION_TARGET.targetTabId);
    await store.submitIssue(
      { ...payload, timestamp: 3_000 },
      DEFAULT_TEST_SESSION_TARGET.targetTabId,
    );

    expect(store.getIssues()).toHaveLength(1);
    expect(store.getIssues()[0]?.occurrenceCount).toBe(2);
  });
});
