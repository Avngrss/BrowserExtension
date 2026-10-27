import { describe, expect, it } from 'vitest';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import {
  buildIssueMarkContext,
  selectActionIdsBeforeMark,
  selectRelatedIssuesInWindow,
} from '@/src/issue-marks/build-issue-mark-context';

describe('buildIssueMarkContext', () => {
  it('selects the latest actions before the mark timestamp', () => {
    const markedAt = 5_000;
    const actionIds = selectActionIdsBeforeMark(
      [
        {
          id: 'a1',
          sessionId: 's1',
          timestamp: 1_000,
          type: 'click',
          url: 'https://example.test/',
          element: { tagName: 'button' },
        },
        {
          id: 'a2',
          sessionId: 's1',
          timestamp: 4_500,
          type: 'navigation',
          url: 'https://example.test/cart',
        },
        {
          id: 'a3',
          sessionId: 's1',
          timestamp: 6_000,
          type: 'click',
          url: 'https://example.test/cart',
          element: { tagName: 'a' },
        },
      ],
      's1',
      markedAt,
      10,
    );
    expect(actionIds).toEqual(['a2', 'a1']);
  });

  it('collects issues seen within the lookback window', () => {
    const markedAt = 100_000;
    const related = selectRelatedIssuesInWindow(
      {
        uiIssues: [
          {
            id: 'ui-1',
            sessionId: 's1',
            timestamp: 8_000,
            lastSeenAt: 99_500,
            ruleId: 'r',
            ruleName: 'Alert',
            severity: 'error',
            url: 'https://example.test/',
            element: { tagName: 'div' },
            occurrenceCount: 1,
            disposition: 'unexpected',
          },
        ],
        consoleIssues: [
          {
            id: 'c-old',
            sessionId: 's1',
            timestamp: 1_000,
            lastSeenAt: 30_000,
            category: 'console-error',
            message: 'old',
            url: 'https://example.test/',
            occurrenceCount: 1,
            disposition: 'unexpected',
          },
        ],
        networkIssues: [],
      },
      's1',
      markedAt,
      60_000,
    );
    expect(related).toEqual([{ category: 'ui', issueId: 'ui-1' }]);
  });

  it('builds pathname and action ids for an active session', () => {
    const slice = buildIssueMarkContext({
      session: {
        status: 'recording',
        id: 's1',
        startedAt: 1,
        pausedAt: null,
        stoppedAt: null,
        pageContextUpdatedAt: 1,
        pageTitle: 'Example',
        ...DEFAULT_TEST_SESSION_TARGET,
        targetUrl: 'https://example.test/products',
      },
      markedAt: 2_000,
      sanitizedPageUrl: 'https://example.test/products',
      actions: [
        {
          id: 'a1',
          sessionId: 's1',
          timestamp: 1_500,
          type: 'click',
          url: 'https://example.test/products',
          element: { tagName: 'button' },
        },
      ],
      uiIssues: [],
      consoleIssues: [],
      networkIssues: [],
    });
    expect(slice.pathname).toBe('/products');
    expect(slice.actionIds).toEqual(['a1']);
    expect(slice.pageTitle).toBe('Example');
  });
});
