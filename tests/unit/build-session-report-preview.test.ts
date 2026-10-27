import { describe, expect, it } from 'vitest';
import type { IssueMark } from '@/src/domain/issue-mark';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import type { ActiveSessionSnapshot } from '@/src/domain/session';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import {
  buildSessionReportPreview,
  formatSessionReportPreviewPlainText,
  resolveReportPreviewScope,
} from '@/src/sidepanel/build-session-report-preview';

const stoppedSession: ActiveSessionSnapshot = {
  status: 'stopped',
  id: 'session-1',
  startedAt: 1_000,
  pausedAt: null,
  stoppedAt: 61_000,
  pageContextUpdatedAt: 1_000,
  pageTitle: 'Diagnostics',
  ...DEFAULT_TEST_SESSION_TARGET,
  targetUrl: 'https://example.test/page',
};

const clickAction = {
  id: 'act-1',
  sessionId: 'session-1',
  timestamp: 2_000,
  type: 'click' as const,
  url: 'https://example.test/page',
  element: { tagName: 'button', accessibleName: 'Submit' },
};

const mark: IssueMark = {
  sessionId: 'session-1',
  markedAt: 5_000,
  note: 'Button stuck',
  pageUrl: 'https://example.test/page',
  pageTitle: 'Diagnostics',
  pathname: '/page',
  actionIds: ['act-1'],
  relatedIssues: [
    { category: 'console', issueId: 'console-1' },
    { category: 'ui', issueId: 'ui-1' },
  ],
  reportScope: 'around-mark',
};

describe('buildSessionReportPreview', () => {
  it('uses activity summary for sessions without a bug signal', () => {
    const preview = buildSessionReportPreview({
      session: stoppedSession,
      scope: 'last-10-actions',
      mark: null,
      bugContext: null,
      actions: [clickAction],
      uiIssues: [],
      consoleIssues: [],
      networkIssues: [],
      screenshotEvidence: [],
    });

    expect(preview.presentationMode).toBe('activity');
    expect(preview.title).toBe('Activity summary');
    expect(preview.activityIntro).toContain('No potential issues');
    expect(preview.stepsHeading).toBe('Recorded actions');
    expect(preview.observedProblem).toBeNull();

    const text = formatSessionReportPreviewPlainText(preview);
    expect(text).not.toContain('Observed problem');
    expect(text).not.toContain('Expected result');
    expect(text).not.toContain('Visual evidence');
  });

  it('switches to bug report preview when What happened? is saved', () => {
    const preview = buildSessionReportPreview({
      session: stoppedSession,
      scope: 'full-session',
      mark: null,
      bugContext: { sessionId: 'session-1', whatHappened: 'Page stuck' },
      actions: [clickAction],
      uiIssues: [],
      consoleIssues: [],
      networkIssues: [],
      screenshotEvidence: [],
    });

    expect(preview.presentationMode).toBe('bug-report');
    expect(preview.title).toBe('Bug report preview');
    expect(preview.observedProblem).toBe('Page stuck');
  });

  it('omits empty UI and visual sections in plain text bug preview', () => {
    const text = formatSessionReportPreviewPlainText(
      buildSessionReportPreview({
        session: stoppedSession,
        scope: 'full-session',
        mark: null,
        bugContext: { sessionId: 'session-1', whatHappened: 'Issue' },
        actions: [],
        uiIssues: [],
        consoleIssues: [],
        networkIssues: [],
        screenshotEvidence: [],
      }),
    );

    expect(text).not.toContain('Observed UI evidence');
    expect(text).not.toContain('Visual evidence');
    expect(text).not.toContain('Technical evidence');
  });

  it('defers activity summary while classification is loading', () => {
    const preview = buildSessionReportPreview({
      session: stoppedSession,
      scope: 'full-session',
      mark: null,
      bugContext: null,
      actions: [clickAction],
      uiIssues: [],
      consoleIssues: [],
      networkIssues: [],
      screenshotEvidence: [],
      classificationReady: false,
    });

    expect(preview.presentationMode).toBe('pending');
  });

  it('keeps excluded-only sessions in activity summary', () => {
    const preview = buildSessionReportPreview({
      session: stoppedSession,
      scope: 'full-session',
      mark: null,
      bugContext: null,
      actions: [clickAction],
      uiIssues: [
        {
          id: 'ui-x',
          sessionId: 'session-1',
          timestamp: 3_100,
          lastSeenAt: 3_100,
          ruleId: 'r2',
          ruleName: 'Hidden',
          severity: 'error',
          url: 'https://example.test/page',
          element: { tagName: 'div' },
          occurrenceCount: 1,
          disposition: 'excluded',
        },
      ],
      consoleIssues: [],
      networkIssues: [],
      screenshotEvidence: [],
    });

    expect(preview.presentationMode).toBe('activity');
  });

  it('shows bug context and empty-state messages without inventing text', () => {
    const preview = buildSessionReportPreview({
      session: stoppedSession,
      scope: 'around-mark',
      mark,
      bugContext: {
        sessionId: 'session-1',
        whatHappened: 'Checkout froze',
        whatWasExpected: 'Cart drawer opens',
      },
      actions: [clickAction],
      uiIssues: [],
      consoleIssues: [],
      networkIssues: [],
      screenshotEvidence: [],
    });

    expect(preview.presentationMode).toBe('bug-report');
    expect(preview.observedProblem).toBe('Checkout froze');
    expect(preview.expectedResult).toBe('Cart drawer opens');
    expect(
      buildSessionReportPreview({
        session: stoppedSession,
        scope: 'around-mark',
        mark,
        bugContext: null,
        actions: [],
        uiIssues: [],
        consoleIssues: [],
        networkIssues: [],
        screenshotEvidence: [],
      }).observedProblem,
    ).toBeNull();
    expect(
      buildSessionReportPreview({
        session: stoppedSession,
        scope: 'around-mark',
        mark,
        bugContext: null,
        actions: [],
        uiIssues: [],
        consoleIssues: [],
        networkIssues: [],
        screenshotEvidence: [],
      }).observedProblemEmpty,
    ).toBe('Observed problem was not described.');
  });

  it('separates UI and technical evidence and omits excluded issues', () => {
    const preview = buildSessionReportPreview({
      session: stoppedSession,
      scope: 'full-session',
      mark: null,
      bugContext: null,
      actions: [clickAction],
      uiIssues: [
        {
          id: 'ui-1',
          sessionId: 'session-1',
          timestamp: 3_000,
          lastSeenAt: 3_000,
          ruleId: 'r1',
          ruleName: 'Alert',
          severity: 'error',
          url: 'https://example.test/page',
          element: { tagName: 'div' },
          occurrenceCount: 1,
          disposition: 'unexpected',
        },
        {
          id: 'ui-x',
          sessionId: 'session-1',
          timestamp: 3_100,
          lastSeenAt: 3_100,
          ruleId: 'r2',
          ruleName: 'Hidden',
          severity: 'error',
          url: 'https://example.test/page',
          element: { tagName: 'div' },
          occurrenceCount: 1,
          disposition: 'excluded',
        },
      ],
      consoleIssues: [
        {
          id: 'c1',
          sessionId: 'session-1',
          timestamp: 4_000,
          lastSeenAt: 4_000,
          category: 'console-error',
          message: 'boom',
          url: 'https://example.test/page',
          occurrenceCount: 2,
          disposition: 'expected',
        },
      ],
      networkIssues: [
        {
          id: 'n1',
          sessionId: 'session-1',
          timestamp: 4_500,
          lastSeenAt: 4_500,
          source: 'fetch',
          category: 'http-error',
          method: 'POST',
          url: 'https://example.test/api/checkout',
          status: 500,
          durationMs: 120,
          occurrenceCount: 1,
          disposition: 'unexpected',
        },
      ],
      screenshotEvidence: [],
    });

    expect(preview.observedUiEvidence).toHaveLength(1);
    expect(preview.consoleEvidence[0]).toContain('Console error');
    expect(preview.consoleEvidence[0]).toContain('2 occurrences');
    expect(preview.networkEvidence[0]).toContain('Fetch POST');
    expect(preview.networkEvidence[0]).not.toContain('example.test');
    expect(preview.networkEvidence[0]).toContain('status 500');
    expect(
      preview.observedUiEvidence.some((row) =>
        row.description.includes('Hidden'),
      ),
    ).toBe(false);
  });

  it('builds numbered step sentences and respects scope', () => {
    const manyActions = Array.from({ length: 12 }, (_, index) => ({
      ...clickAction,
      id: `act-${index}`,
      timestamp: 1_000 + index * 100,
      element: {
        tagName: 'button',
        accessibleName: `Action ${index}`,
      },
    }));

    const lastTen = buildSessionReportPreview({
      session: stoppedSession,
      scope: 'last-10-actions',
      mark: null,
      bugContext: { sessionId: 'session-1', whatHappened: 'Scope test' },
      actions: manyActions,
      uiIssues: [],
      consoleIssues: [
        {
          id: 'c1',
          sessionId: 'session-1',
          timestamp: 1,
          lastSeenAt: 1,
          category: 'console-error',
          message: 'hidden',
          url: 'https://example.test/',
          occurrenceCount: 1,
          disposition: 'unexpected',
        },
      ],
      networkIssues: [],
      screenshotEvidence: [],
    });

    expect(lastTen.steps).toHaveLength(10);
    expect(lastTen.steps[0]).toMatch(/Clicked/);
    expect(lastTen.consoleEvidence).toHaveLength(0);

    const around = buildSessionReportPreview({
      session: stoppedSession,
      scope: 'around-mark',
      mark,
      bugContext: null,
      actions: [clickAction],
      uiIssues: [],
      consoleIssues: [
        {
          id: 'console-1',
          sessionId: 'session-1',
          timestamp: 4_000,
          lastSeenAt: 4_000,
          category: 'console-error',
          message: 'boom',
          url: 'https://example.test/page',
          occurrenceCount: 1,
          disposition: 'unexpected',
        },
      ],
      networkIssues: [],
      screenshotEvidence: [],
    });
    expect(around.steps).toHaveLength(1);
    expect(around.consoleEvidence).toHaveLength(1);
    expect(around.networkEvidence).toHaveLength(0);
  });

  it('reflects screenshot removal and renders plain text without internal ids', () => {
    const uiIssue = {
      id: 'ui-1',
      sessionId: 'session-1',
      timestamp: 3_000,
      lastSeenAt: 3_000,
      ruleId: 'r',
      ruleName: 'Alert',
      severity: 'error' as const,
      url: 'https://example.test/page',
      element: { tagName: 'div' },
      occurrenceCount: 1,
      disposition: 'unexpected' as const,
    };
    const uiEvidence: ScreenshotEvidence = {
      id: 'ev-ui',
      frameId: 'frame-ui',
      sessionId: 'session-1',
      issueCategory: 'ui',
      issueId: 'ui-1',
      capturedAt: 3_000,
      pageUrl: null,
      width: 100,
      height: 100,
      format: 'jpeg',
      storageRef: 'secret-ref',
      status: 'captured',
      linkedIssueCount: 1,
    };
    const withShot = buildSessionReportPreview({
      session: stoppedSession,
      scope: 'full-session',
      mark: null,
      bugContext: null,
      actions: [],
      uiIssues: [uiIssue],
      consoleIssues: [],
      networkIssues: [],
      screenshotEvidence: [uiEvidence],
    });
    const withoutShot = buildSessionReportPreview({
      session: stoppedSession,
      scope: 'full-session',
      mark: null,
      bugContext: null,
      actions: [],
      uiIssues: [uiIssue],
      consoleIssues: [],
      networkIssues: [],
      screenshotEvidence: [],
    });

    expect(withShot.visualEvidence).toHaveLength(1);
    expect(withoutShot.visualEvidence).toHaveLength(0);

    const text = formatSessionReportPreviewPlainText(
      buildSessionReportPreview({
        session: stoppedSession,
        scope: 'around-mark',
        mark,
        bugContext: { sessionId: 'session-1', whatHappened: 'Note' },
        actions: [clickAction],
        uiIssues: [],
        consoleIssues: [],
        networkIssues: [],
        screenshotEvidence: [],
      }),
    );
    expect(text).toContain('Bug report preview');
    expect(text).toContain('Observed problem');
    expect(text).not.toMatch(/session-1|secret-ref|act-1/);
  });

  it('refines preview steps without changing scope behavior', () => {
    const navClick = {
      ...clickAction,
      id: 'nav-click',
      type: 'click' as const,
      element: { tagName: 'a', accessibleName: 'Products' },
    };
    const navEvent = {
      id: 'nav-event',
      sessionId: 'session-1',
      timestamp: 2_500,
      type: 'navigation' as const,
      url: 'https://example.test/products',
      pageTitle: 'Products',
    };

    const preview = buildSessionReportPreview({
      session: stoppedSession,
      scope: 'full-session',
      mark: null,
      bugContext: { sessionId: 'session-1', whatHappened: 'Bug' },
      actions: [navClick, navEvent],
      uiIssues: [],
      consoleIssues: [],
      networkIssues: [],
      screenshotEvidence: [],
    });

    expect(preview.steps).toEqual(['Opened the products page.']);
  });

  it('resolves scope from mark or without-mark preference', () => {
    expect(
      resolveReportPreviewScope({
        mark,
        markReportScope: 'around-mark',
        reportScopeWithoutMark: 'last-10-actions',
      }),
    ).toBe('around-mark');
  });
});
