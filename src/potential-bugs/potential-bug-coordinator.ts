import type { CapturedAction } from '@/src/domain/action';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type { NewUniqueIssueEvent } from '@/src/domain/new-unique-issue';
import {
  POTENTIAL_BUG_GROUPING_WINDOW_MS,
  type PotentialBug,
  type PotentialBugIssueCategory,
  type PotentialBugIssueRef,
  type PotentialBugPage,
} from '@/src/domain/potential-bug';
import {
  isActiveSession,
  type ActiveSessionSnapshot,
  type SessionSnapshot,
} from '@/src/domain/session';
import type { UiIssue } from '@/src/domain/ui-issue';
import type { PotentialBugStore } from '@/src/potential-bugs/potential-bug-store';
import { getMonitoredPathname } from '@/src/sidepanel/session-display';

export type PotentialBugCoordinatorDeps = {
  store: PotentialBugStore;
  getSessionState: () => SessionSnapshot;
  sanitizePageUrl: (url: string) => string | null;
  getActions: () => CapturedAction[];
  getIssues: () => {
    uiIssues: UiIssue[];
    consoleIssues: ConsoleIssue[];
    networkIssues: NetworkIssue[];
  };
  now: () => number;
  onBugCreated: (input: {
    bug: PotentialBug;
    issueCategory: PotentialBugIssueCategory;
  }) => void;
  onBugsChanged: () => void;
  requestManualScreenshot: (bugId: string) => void;
};

export type ManualCaptureResult =
  | { ok: true; bug: PotentialBug }
  | { ok: false; code: 'NO_ACTIVE_SESSION'; message: string };

function buildPage(
  session: ActiveSessionSnapshot,
  sanitizePageUrl: (url: string) => string | null,
): PotentialBugPage | null {
  const url = sanitizePageUrl(session.targetUrl);
  if (url === null) {
    return null;
  }
  const title = session.pageTitle?.trim();
  return {
    url,
    pathname: getMonitoredPathname({ ...session, targetUrl: url }),
    ...(title !== undefined && title.length > 0 ? { title } : {}),
  };
}

function nearbyIssues(
  issues: ReturnType<PotentialBugCoordinatorDeps['getIssues']>,
  sessionId: string,
  capturedAt: number,
): PotentialBugIssueRef[] {
  const windowStart = capturedAt - POTENTIAL_BUG_GROUPING_WINDOW_MS;
  const near = (issue: {
    sessionId: string;
    lastSeenAt: number;
    disposition: string;
  }) =>
    issue.sessionId === sessionId &&
    issue.disposition !== 'excluded' &&
    issue.lastSeenAt >= windowStart &&
    issue.lastSeenAt <= capturedAt;

  return [
    ...issues.uiIssues
      .filter(near)
      .map((issue) => ({ category: 'ui' as const, issueId: issue.id })),
    ...issues.consoleIssues
      .filter(near)
      .map((issue) => ({ category: 'console' as const, issueId: issue.id })),
    ...issues.networkIssues
      .filter(near)
      .map((issue) => ({ category: 'network' as const, issueId: issue.id })),
  ];
}

export function createPotentialBugCoordinator(
  deps: PotentialBugCoordinatorDeps,
) {
  async function handleNewUniqueIssue(
    event: NewUniqueIssueEvent,
  ): Promise<void> {
    if (event.issueCategory === 'mark') {
      return;
    }
    const session = deps.getSessionState();
    if (!isActiveSession(session) || session.status !== 'recording') {
      return;
    }
    const page = buildPage(session, deps.sanitizePageUrl);
    if (page === null) {
      return;
    }
    const result = await deps.store.recordDetectedIssue({
      sessionId: session.id,
      issue: { category: event.issueCategory, issueId: event.issueId },
      detectedAt: deps.now(),
      page,
      actions: deps.getActions(),
    });
    if (result.bug === null) {
      return;
    }
    deps.onBugsChanged();
    if (result.created) {
      deps.onBugCreated({
        bug: result.bug,
        issueCategory: event.issueCategory,
      });
    }
  }

  async function captureManual(input: {
    note?: string;
  }): Promise<ManualCaptureResult> {
    const session = deps.getSessionState();
    if (
      !isActiveSession(session) ||
      (session.status !== 'recording' && session.status !== 'paused')
    ) {
      return {
        ok: false,
        code: 'NO_ACTIVE_SESSION',
        message: 'Start capture before capturing a bug.',
      };
    }
    const page = buildPage(session, deps.sanitizePageUrl);
    if (page === null) {
      return {
        ok: false,
        code: 'NO_ACTIVE_SESSION',
        message: 'The monitored page URL is unavailable.',
      };
    }
    const capturedAt = deps.now();
    const bug = await deps.store.captureManual({
      sessionId: session.id,
      capturedAt,
      page,
      actions: deps.getActions(),
      nearbyIssues: nearbyIssues(deps.getIssues(), session.id, capturedAt),
      ...(input.note !== undefined ? { note: input.note } : {}),
    });
    deps.requestManualScreenshot(bug.id);
    deps.onBugsChanged();
    return { ok: true, bug };
  }

  return { handleNewUniqueIssue, captureManual };
}

export type PotentialBugCoordinator = ReturnType<
  typeof createPotentialBugCoordinator
>;
