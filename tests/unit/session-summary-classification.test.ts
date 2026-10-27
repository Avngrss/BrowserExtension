import { describe, expect, it } from 'vitest';
import { resolveSessionSummaryPresentationMode } from '@/src/sidepanel/session-summary-classification';

const sessionId = 'session-1';

describe('resolveSessionSummaryPresentationMode', () => {
  it('waits for issue data before showing activity summary', () => {
    expect(
      resolveSessionSummaryPresentationMode({
        sessionId,
        mark: null,
        bugContext: null,
        uiIssues: [],
        consoleIssues: [],
        networkIssues: [],
        classificationReady: false,
      }),
    ).toBe('pending');
  });

  it('shows bug report when a non-excluded UI issue exists', () => {
    expect(
      resolveSessionSummaryPresentationMode({
        sessionId,
        mark: null,
        bugContext: null,
        uiIssues: [
          {
            id: 'u1',
            sessionId,
            timestamp: 1,
            lastSeenAt: 1,
            ruleId: 'r',
            ruleName: 'Alert',
            severity: 'error',
            url: 'https://example.test/',
            element: { tagName: 'div' },
            occurrenceCount: 1,
            disposition: 'unexpected',
          },
        ],
        consoleIssues: [],
        networkIssues: [],
        classificationReady: true,
      }),
    ).toBe('bug-report');
  });

  it('stays in activity summary until What happened? is saved', () => {
    expect(
      resolveSessionSummaryPresentationMode({
        sessionId,
        mark: null,
        bugContext: null,
        uiIssues: [],
        consoleIssues: [],
        networkIssues: [],
        classificationReady: true,
      }),
    ).toBe('activity');
  });

  it('keeps excluded-only sessions in activity summary', () => {
    expect(
      resolveSessionSummaryPresentationMode({
        sessionId,
        mark: null,
        bugContext: null,
        uiIssues: [
          {
            id: 'u1',
            sessionId,
            timestamp: 1,
            lastSeenAt: 1,
            ruleId: 'r',
            ruleName: 'Alert',
            severity: 'error',
            url: 'https://example.test/',
            element: { tagName: 'div' },
            occurrenceCount: 1,
            disposition: 'excluded',
          },
        ],
        consoleIssues: [],
        networkIssues: [],
        classificationReady: true,
      }),
    ).toBe('activity');
  });
});
