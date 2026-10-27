import { describe, expect, it } from 'vitest';
import {
  sessionHasBugSignal,
  sessionHasNonExcludedIssue,
} from '@/src/sidepanel/session-bug-signal';
import type { IssueMark } from '@/src/domain/issue-mark';

const sessionId = 'session-1';

const mark: IssueMark = {
  sessionId,
  markedAt: 1,
  note: 'Broken',
  pageUrl: 'https://example.test/',
  pageTitle: 'T',
  pathname: '/',
  actionIds: [],
  relatedIssues: [],
  reportScope: 'full-session',
};

describe('sessionHasBugSignal', () => {
  it('is false for a clean session', () => {
    expect(
      sessionHasBugSignal({
        sessionId,
        mark: null,
        bugContext: null,
        uiIssues: [],
        consoleIssues: [],
        networkIssues: [],
      }),
    ).toBe(false);
  });

  it('is true when a mark exists', () => {
    expect(
      sessionHasBugSignal({
        sessionId,
        mark,
        bugContext: null,
        uiIssues: [],
        consoleIssues: [],
        networkIssues: [],
      }),
    ).toBe(true);
  });

  it('is true when What happened? is saved', () => {
    expect(
      sessionHasBugSignal({
        sessionId,
        mark: null,
        bugContext: { sessionId, whatHappened: 'Something broke' },
        uiIssues: [],
        consoleIssues: [],
        networkIssues: [],
      }),
    ).toBe(true);
  });

  it('is true for a non-excluded issue', () => {
    expect(
      sessionHasBugSignal({
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
      }),
    ).toBe(true);
  });

  it('stays false when only excluded issues exist', () => {
    expect(
      sessionHasNonExcludedIssue({
        sessionId,
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
      }),
    ).toBe(false);
    expect(
      sessionHasBugSignal({
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
      }),
    ).toBe(false);
  });
});
