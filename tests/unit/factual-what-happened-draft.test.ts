import { describe, expect, it } from 'vitest';
import { buildFactualWhatHappenedDraft } from '@/src/bug-report/factual-what-happened-draft';

const sessionId = 'session-1';

describe('buildFactualWhatHappenedDraft', () => {
  it('prefers mark note then included UI issue', () => {
    expect(
      buildFactualWhatHappenedDraft({
        sessionId,
        mark: {
          sessionId,
          markedAt: 1,
          note: 'Checkout froze',
          pageUrl: 'https://example.test/',
          pageTitle: 'T',
          pathname: '/',
          actionIds: [],
          relatedIssues: [],
          reportScope: 'full-session',
        },
        savedBugContext: null,
        bugContextLoaded: true,
        classificationReady: true,
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
            visibleMessage: 'Payment unavailable',
          },
        ],
        consoleIssues: [],
        networkIssues: [],
      }),
    ).toBe('Checkout froze');
  });

  it('builds UI and console drafts from recorded evidence', () => {
    expect(
      buildFactualWhatHappenedDraft({
        sessionId,
        mark: null,
        savedBugContext: null,
        bugContextLoaded: true,
        classificationReady: true,
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
            visibleMessage: 'Payment unavailable',
          },
        ],
        consoleIssues: [],
        networkIssues: [],
      }),
    ).toBe('The page displayed “Payment unavailable”.');
  });

  it('does not overwrite saved bug context', () => {
    expect(
      buildFactualWhatHappenedDraft({
        sessionId,
        mark: null,
        savedBugContext: { sessionId, whatHappened: 'User text' },
        bugContextLoaded: true,
        classificationReady: true,
        uiIssues: [],
        consoleIssues: [],
        networkIssues: [],
      }),
    ).toBeUndefined();
  });
});
