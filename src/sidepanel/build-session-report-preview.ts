import { describeActionReportStep } from '@/src/actions/action-report-steps';
import { refinePreviewActionSteps } from '@/src/actions/refine-preview-action-steps';
import { resolveSessionSummaryPresentationMode } from '@/src/sidepanel/session-summary-classification';
import type { CapturedAction } from '@/src/domain/action';
import type { BugReportContext } from '@/src/domain/bug-report-context';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { IssueMark } from '@/src/domain/issue-mark';
import { ISSUE_MARK_SCREENSHOT_ISSUE_ID } from '@/src/domain/issue-mark';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type { ActiveSessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import { screenshotStatusLabel } from '@/src/domain/screenshot-evidence';
import type { UiIssue } from '@/src/domain/ui-issue';
import { describeUiIssue } from '@/src/ui/ui-issue-descriptions';
import {
  formatConsoleTechnicalEvidence,
  formatNetworkTechnicalEvidence,
} from '@/src/sidepanel/report-technical-evidence';
import {
  formatSessionDuration,
  getMonitoredPageTitle,
  getMonitoredPathname,
  getSessionDurationMs,
} from '@/src/sidepanel/session-display';

export type ReportPreviewScope =
  'around-mark' | 'full-session' | 'last-10-actions';

export type SessionReportPreviewUiLine = {
  description: string;
  expected: boolean;
};

export type SessionSummaryPreview = {
  presentationMode: 'pending' | 'activity' | 'bug-report';
  sectionAriaLabel: string;
  title: string;
  activityIntro: string | null;
  scope: ReportPreviewScope;
  scopeLabel: string;
  observedProblem: string | null;
  observedProblemEmpty: string;
  expectedResult: string | null;
  expectedResultEmpty: string;
  steps: string[];
  stepsHeading: string;
  stepsEmpty: string;
  observedUiEvidence: SessionReportPreviewUiLine[];
  consoleEvidence: string[];
  networkEvidence: string[];
  technicalEmpty: string;
  visualEvidence: string[];
  sessionContext: string[];
};

/** @deprecated Use SessionSummaryPreview */
export type SessionReportPreview = SessionSummaryPreview;

const OBSERVED_EMPTY = 'Observed problem was not described.';
const EXPECTED_EMPTY = 'Expected result was not provided.';
const STEPS_EMPTY = 'No steps are included in this report preview.';
const ACTIVITY_INTRO = 'No potential issues were detected in this session.';
const CLASSIFICATION_PENDING = 'Loading session summary…';
const ACTIVITY_STEPS_EMPTY = 'No actions were recorded in this session.';

export function reportScopeLabel(scope: ReportPreviewScope): string {
  switch (scope) {
    case 'around-mark':
      return 'Around marked issue';
    case 'full-session':
      return 'Full session';
    case 'last-10-actions':
      return 'Last 10 actions';
  }
}

function sortActionsChronologically(
  actions: CapturedAction[],
): CapturedAction[] {
  return [...actions].sort((left, right) => left.timestamp - right.timestamp);
}

function lastNActions(
  actions: CapturedAction[],
  sessionId: string,
  n: number,
): CapturedAction[] {
  return sortActionsChronologically(
    actions.filter((action) => action.sessionId === sessionId),
  ).slice(-n);
}

function actionsByIds(
  actions: CapturedAction[],
  ids: string[],
): CapturedAction[] {
  const byId = new Map(actions.map((action) => [action.id, action]));
  const ordered: CapturedAction[] = [];
  for (const id of ids) {
    const action = byId.get(id);
    if (action !== undefined) {
      ordered.push(action);
    }
  }
  return sortActionsChronologically(ordered);
}

function relatedIssueKeys(mark: IssueMark): Set<string> {
  return new Set(
    mark.relatedIssues.map((item) => `${item.category}:${item.issueId}`),
  );
}

function isIncluded<T extends { id: string; disposition: string }>(
  item: T,
  related: Set<string> | null,
  category: string,
): boolean {
  if (item.disposition === 'excluded') {
    return false;
  }
  if (related === null) {
    return true;
  }
  return related.has(`${category}:${item.id}`);
}

function visualLabelForEvidence(
  evidence: ScreenshotEvidence,
  issueDescriptionByKey: Map<string, string>,
): string {
  if (evidence.issueCategory === 'mark') {
    const status =
      evidence.status === 'captured'
        ? 'Screenshot captured'
        : screenshotStatusLabel({
            status: evidence.status,
            failureReason: evidence.failureReason,
          }) || 'Screenshot pending';
    return `Marked issue — ${status}`;
  }

  const key = `${evidence.issueCategory}:${evidence.issueId}`;
  const description = issueDescriptionByKey.get(key) ?? 'Issue screenshot';
  if (evidence.status === 'captured') {
    return `${description} — Screenshot captured`;
  }
  const status =
    screenshotStatusLabel({
      status: evidence.status,
      failureReason: evidence.failureReason,
    }) || 'Screenshot pending';
  return `${description} — ${status}`;
}

function buildCompactActivityContextLines(
  session: ActiveSessionSnapshot & { status: 'stopped' },
): string[] {
  const lines: string[] = [];
  const title = getMonitoredPageTitle(session);
  if (title !== undefined && title.length > 0) {
    lines.push(title);
  }
  lines.push(`Page: ${getMonitoredPathname(session)}`);
  const durationMs = getSessionDurationMs(session, session.stoppedAt);
  if (durationMs !== null) {
    lines.push(`Duration ${formatSessionDuration(durationMs)}`);
  }
  return lines;
}

function buildSessionContextLines(input: {
  session: ActiveSessionSnapshot & { status: 'stopped' };
  scopeLabel: string;
  mark: IssueMark | null;
}): string[] {
  const lines: string[] = [];
  const title =
    getMonitoredPageTitle(input.session) ?? input.mark?.pageTitle?.trim();
  if (title !== undefined && title.length > 0) {
    lines.push(title);
  }
  lines.push(`Page: ${getMonitoredPathname(input.session)}`);
  if (input.mark !== null) {
    lines.push(`Marked ${new Date(input.mark.markedAt).toLocaleString()}`);
  }
  const durationMs = getSessionDurationMs(
    input.session,
    input.session.stoppedAt,
  );
  if (durationMs !== null) {
    lines.push(`Duration ${formatSessionDuration(durationMs)}`);
  }
  lines.push(`Report scope: ${input.scopeLabel}`);
  return lines;
}

export function resolveReportPreviewScope(input: {
  mark: IssueMark | null;
  markReportScope: IssueMark['reportScope'] | undefined;
  reportScopeWithoutMark: 'last-10-actions' | 'full-session';
}): ReportPreviewScope {
  if (input.mark !== null) {
    return input.mark.reportScope;
  }
  return input.reportScopeWithoutMark;
}

function mapActionsToRefinedSteps(actions: CapturedAction[]): string[] {
  return refinePreviewActionSteps(actions.map(describeActionReportStep));
}

function buildActivitySummaryPreview(input: {
  session: ActiveSessionSnapshot;
  actions: CapturedAction[];
}): SessionSummaryPreview {
  const sessionId = input.session.id;
  const stepActions = sortActionsChronologically(
    input.actions.filter((action) => action.sessionId === sessionId),
  );
  const steps = mapActionsToRefinedSteps(stepActions);
  return {
    presentationMode: 'activity',
    sectionAriaLabel: 'Activity summary',
    title: 'Activity summary',
    activityIntro: ACTIVITY_INTRO,
    scope: 'full-session',
    scopeLabel: reportScopeLabel('full-session'),
    observedProblem: null,
    observedProblemEmpty: OBSERVED_EMPTY,
    expectedResult: null,
    expectedResultEmpty: EXPECTED_EMPTY,
    steps,
    stepsHeading: 'Recorded actions',
    stepsEmpty: ACTIVITY_STEPS_EMPTY,
    observedUiEvidence: [],
    consoleEvidence: [],
    networkEvidence: [],
    technicalEmpty: '',
    visualEvidence: [],
    sessionContext:
      input.session.status === 'stopped'
        ? buildCompactActivityContextLines(input.session)
        : [],
  };
}

function buildPendingSummaryPreview(
  session: ActiveSessionSnapshot,
): SessionSummaryPreview {
  return {
    presentationMode: 'pending',
    sectionAriaLabel: 'Session summary loading',
    title: 'Session summary',
    activityIntro: CLASSIFICATION_PENDING,
    scope: 'full-session',
    scopeLabel: reportScopeLabel('full-session'),
    observedProblem: null,
    observedProblemEmpty: OBSERVED_EMPTY,
    expectedResult: null,
    expectedResultEmpty: EXPECTED_EMPTY,
    steps: [],
    stepsHeading: 'Recorded actions',
    stepsEmpty: ACTIVITY_STEPS_EMPTY,
    observedUiEvidence: [],
    consoleEvidence: [],
    networkEvidence: [],
    technicalEmpty: '',
    visualEvidence: [],
    sessionContext:
      session.status === 'stopped'
        ? buildCompactActivityContextLines(session)
        : [],
  };
}

export function buildSessionSummaryPreview(input: {
  session: ActiveSessionSnapshot;
  scope: ReportPreviewScope;
  mark: IssueMark | null;
  bugContext: BugReportContext | null;
  actions: CapturedAction[];
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
  screenshotEvidence: ScreenshotEvidence[];
  classificationReady?: boolean;
}): SessionSummaryPreview {
  const mode = resolveSessionSummaryPresentationMode({
    sessionId: input.session.id,
    mark: input.mark,
    bugContext: input.bugContext,
    uiIssues: input.uiIssues,
    consoleIssues: input.consoleIssues,
    networkIssues: input.networkIssues,
    classificationReady: input.classificationReady ?? true,
  });
  if (mode === 'pending') {
    return buildPendingSummaryPreview(input.session);
  }
  if (mode === 'activity') {
    return buildActivitySummaryPreview({
      session: input.session,
      actions: input.actions,
    });
  }
  return buildBugReportPreview(input);
}

export function buildSessionReportPreview(input: {
  session: ActiveSessionSnapshot;
  scope: ReportPreviewScope;
  mark: IssueMark | null;
  bugContext: BugReportContext | null;
  actions: CapturedAction[];
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
  screenshotEvidence: ScreenshotEvidence[];
  classificationReady?: boolean;
}): SessionSummaryPreview {
  return buildSessionSummaryPreview(input);
}

function buildBugReportPreview(input: {
  session: ActiveSessionSnapshot;
  scope: ReportPreviewScope;
  mark: IssueMark | null;
  bugContext: BugReportContext | null;
  actions: CapturedAction[];
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
  screenshotEvidence: ScreenshotEvidence[];
}): SessionSummaryPreview {
  const sessionId = input.session.id;
  const scopeLabel = reportScopeLabel(input.scope);
  const related =
    input.scope === 'around-mark' && input.mark !== null
      ? relatedIssueKeys(input.mark)
      : input.scope === 'last-10-actions'
        ? new Set<string>()
        : null;

  let stepActions: CapturedAction[] = [];
  let uiRows: UiIssue[] = [];
  let consoleRows: ConsoleIssue[] = [];
  let networkRows: NetworkIssue[] = [];
  let evidence: ScreenshotEvidence[] = [];
  const technicalEmpty = '';

  if (input.scope === 'around-mark' && input.mark !== null) {
    stepActions = actionsByIds(input.actions, input.mark.actionIds);
    uiRows = input.uiIssues.filter(
      (issue) =>
        issue.sessionId === sessionId && isIncluded(issue, related, 'ui'),
    );
    consoleRows = input.consoleIssues.filter(
      (issue) =>
        issue.sessionId === sessionId && isIncluded(issue, related, 'console'),
    );
    networkRows = input.networkIssues.filter(
      (issue) =>
        issue.sessionId === sessionId && isIncluded(issue, related, 'network'),
    );
    evidence = input.screenshotEvidence.filter(
      (item) =>
        item.sessionId === sessionId &&
        item.issueCategory === 'mark' &&
        item.issueId === ISSUE_MARK_SCREENSHOT_ISSUE_ID,
    );
  } else if (input.scope === 'full-session') {
    stepActions = sortActionsChronologically(
      input.actions.filter((action) => action.sessionId === sessionId),
    );
    uiRows = input.uiIssues.filter(
      (issue) =>
        issue.sessionId === sessionId && isIncluded(issue, related, 'ui'),
    );
    consoleRows = input.consoleIssues.filter(
      (issue) =>
        issue.sessionId === sessionId && isIncluded(issue, related, 'console'),
    );
    networkRows = input.networkIssues.filter(
      (issue) =>
        issue.sessionId === sessionId && isIncluded(issue, related, 'network'),
    );
    const includedKeys = new Set([
      ...uiRows.map((row) => `ui:${row.id}`),
      ...consoleRows.map((row) => `console:${row.id}`),
      ...networkRows.map((row) => `network:${row.id}`),
    ]);
    evidence = input.screenshotEvidence.filter((item) => {
      if (item.sessionId !== sessionId) {
        return false;
      }
      if (item.issueCategory === 'mark') {
        return input.mark !== null;
      }
      return includedKeys.has(`${item.issueCategory}:${item.issueId}`);
    });
  } else {
    stepActions = lastNActions(input.actions, sessionId, 10);
  }

  const issueDescriptionByKey = new Map<string, string>();
  for (const issue of uiRows) {
    issueDescriptionByKey.set(`ui:${issue.id}`, describeUiIssue(issue));
  }
  for (const issue of consoleRows) {
    issueDescriptionByKey.set(
      `console:${issue.id}`,
      formatConsoleTechnicalEvidence(issue),
    );
  }
  for (const issue of networkRows) {
    issueDescriptionByKey.set(
      `network:${issue.id}`,
      formatNetworkTechnicalEvidence(issue),
    );
  }
  if (input.mark !== null && input.scope === 'full-session') {
    issueDescriptionByKey.set('mark:user-mark', 'Marked issue');
  }

  const whatHappened = input.bugContext?.whatHappened?.trim();
  const whatExpected = input.bugContext?.whatWasExpected?.trim();

  return {
    presentationMode: 'bug-report',
    sectionAriaLabel: 'Bug report preview',
    title: 'Bug report preview',
    activityIntro: null,
    scope: input.scope,
    scopeLabel,
    observedProblem:
      whatHappened !== undefined && whatHappened.length > 0
        ? whatHappened
        : null,
    observedProblemEmpty: OBSERVED_EMPTY,
    expectedResult:
      whatExpected !== undefined && whatExpected.length > 0
        ? whatExpected
        : null,
    expectedResultEmpty: EXPECTED_EMPTY,
    steps: mapActionsToRefinedSteps(stepActions),
    stepsHeading: 'Steps before the issue',
    stepsEmpty: STEPS_EMPTY,
    observedUiEvidence: uiRows.map((issue) => ({
      description: describeUiIssue(issue),
      expected: issue.disposition === 'expected',
    })),
    consoleEvidence: consoleRows.map(formatConsoleTechnicalEvidence),
    networkEvidence: networkRows.map(formatNetworkTechnicalEvidence),
    technicalEmpty,
    visualEvidence: evidence.map((item) =>
      visualLabelForEvidence(item, issueDescriptionByKey),
    ),
    sessionContext:
      input.session.status === 'stopped'
        ? buildSessionContextLines({
            session: input.session,
            scopeLabel,
            mark: input.mark,
          })
        : [scopeLabel],
  };
}

export function isStoppedSessionForPreview(
  snapshot: import('@/src/domain/session').SessionSnapshot,
): snapshot is ActiveSessionSnapshot & { status: 'stopped' } {
  return isActiveSession(snapshot) && snapshot.status === 'stopped';
}

export function formatSessionSummaryPreviewPlainText(
  preview: SessionSummaryPreview,
): string {
  const lines: string[] = [preview.title];
  if (preview.presentationMode === 'pending') {
    if (preview.activityIntro !== null) {
      lines.push(preview.activityIntro);
    }
    return lines.join('\n');
  }
  if (preview.presentationMode === 'activity') {
    if (preview.activityIntro !== null) {
      lines.push(preview.activityIntro);
    }
    lines.push(preview.stepsHeading);
    if (preview.steps.length === 0) {
      lines.push(preview.stepsEmpty);
    } else {
      preview.steps.forEach((step, index) => {
        lines.push(`${index + 1}. ${step}`);
      });
    }
    lines.push('Session context');
    for (const line of preview.sessionContext) {
      lines.push(line);
    }
    return lines.join('\n');
  }

  lines.push('Observed problem');
  lines.push(preview.observedProblem ?? preview.observedProblemEmpty);
  lines.push('Expected result');
  lines.push(preview.expectedResult ?? preview.expectedResultEmpty);
  lines.push(preview.stepsHeading);
  if (preview.steps.length === 0) {
    lines.push(preview.stepsEmpty);
  } else {
    preview.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step}`);
    });
  }
  if (preview.observedUiEvidence.length > 0) {
    lines.push('Observed UI evidence');
    for (const item of preview.observedUiEvidence) {
      lines.push(
        item.expected ? `${item.description} [Expected]` : item.description,
      );
    }
  }
  if (
    preview.consoleEvidence.length > 0 ||
    preview.networkEvidence.length > 0
  ) {
    lines.push('Technical evidence');
    if (preview.consoleEvidence.length > 0) {
      lines.push('Console');
      for (const line of preview.consoleEvidence) {
        lines.push(line);
      }
    }
    if (preview.networkEvidence.length > 0) {
      lines.push('Network');
      for (const line of preview.networkEvidence) {
        lines.push(line);
      }
    }
  }
  if (preview.visualEvidence.length > 0) {
    lines.push('Visual evidence');
    for (const line of preview.visualEvidence) {
      lines.push(line);
    }
  }
  lines.push('Session context');
  for (const line of preview.sessionContext) {
    lines.push(line);
  }
  return lines.join('\n');
}

export function formatSessionReportPreviewPlainText(
  preview: SessionSummaryPreview,
): string {
  return formatSessionSummaryPreviewPlainText(preview);
}
