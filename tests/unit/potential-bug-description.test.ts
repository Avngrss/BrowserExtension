import { describe, expect, it } from 'vitest';
import {
  buildPotentialBugDescription,
  countPotentialBugScreenshots,
} from '@/src/potential-bugs/potential-bug-description';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import {
  SESSION_ID,
  consoleIssue,
  networkIssue,
  potentialBug,
  uiIssue,
} from '../helpers/potential-bug-fixtures';

const lookup = {
  uiIssues: [uiIssue('u1')],
  consoleIssues: [consoleIssue('c1')],
  networkIssues: [networkIssue('n1')],
};

const allIssues = [
  { category: 'network' as const, issueId: 'n1' },
  { category: 'console' as const, issueId: 'c1' },
  { category: 'ui' as const, issueId: 'u1' },
];

describe('buildPotentialBugDescription', () => {
  it('prefers the tester note', () => {
    expect(
      buildPotentialBugDescription(
        potentialBug('b', { note: 'Total is wrong', issues: allIssues }),
        lookup,
      ),
    ).toBe('Total is wrong');
  });

  it('falls back to UI, then Console, then Network facts', () => {
    expect(
      buildPotentialBugDescription(
        potentialBug('b', { issues: allIssues }),
        lookup,
      ),
    ).toBe('The page displayed “Payment unavailable”.');
    expect(
      buildPotentialBugDescription(
        potentialBug('b', { issues: allIssues.slice(0, 2) }),
        lookup,
      ),
    ).toBe('A JavaScript error was recorded: “Boom”.');
    expect(
      buildPotentialBugDescription(
        potentialBug('b', { issues: allIssues.slice(0, 1) }),
        lookup,
      ),
    ).toBe('POST /api/pay returned HTTP 500.');
  });

  it('states only the capture fact for a manual bug without note or issues', () => {
    expect(
      buildPotentialBugDescription(
        potentialBug('b', { source: 'manual' }),
        lookup,
      ),
    ).toBe('Captured manually on /checkout.');
  });
});

describe('countPotentialBugScreenshots', () => {
  function evidence(
    overrides: Partial<ScreenshotEvidence>,
  ): ScreenshotEvidence {
    return {
      id: 'e',
      frameId: 'f1',
      sessionId: SESSION_ID,
      issueCategory: 'ui',
      issueId: 'u1',
      capturedAt: 1,
      pageUrl: null,
      width: 1,
      height: 1,
      format: 'jpeg',
      storageRef: 'r',
      status: 'captured',
      linkedIssueCount: 1,
      ...overrides,
    };
  }

  it('counts distinct frames linked to the bug issues or manual capture', () => {
    const bug = potentialBug('bug-1', {
      issues: [
        { category: 'ui', issueId: 'u1' },
        { category: 'console', issueId: 'c1' },
      ],
    });
    expect(
      countPotentialBugScreenshots(bug, [
        evidence({ id: 'e1' }),
        evidence({ id: 'e2', issueCategory: 'console', issueId: 'c1' }),
        evidence({
          id: 'e3',
          frameId: 'f2',
          issueCategory: 'mark',
          issueId: 'bug-1',
        }),
        evidence({ id: 'e4', frameId: 'f3', issueId: 'other' }),
        evidence({ id: 'e5', frameId: 'f4', status: 'failed' }),
      ]),
    ).toBe(2);
  });
});
