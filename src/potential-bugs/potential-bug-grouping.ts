import { describeActionReportStep } from '@/src/actions/action-report-steps';
import { refineActionStepEntries } from '@/src/actions/refine-preview-action-steps';
import type { CapturedAction } from '@/src/domain/action';
import {
  POTENTIAL_BUG_GROUPING_WINDOW_MS,
  POTENTIAL_BUG_MAX_ACTIONS,
  potentialBugPageKey,
  type PotentialBug,
  type PotentialBugAction,
  type PotentialBugIssueRef,
  type PotentialBugPage,
} from '@/src/domain/potential-bug';

export function selectMeaningfulActions(
  actions: CapturedAction[],
  sessionId: string,
  detectedAt: number,
  limit: number = POTENTIAL_BUG_MAX_ACTIONS,
): PotentialBugAction[] {
  const eligible = actions
    .filter(
      (action) =>
        action.sessionId === sessionId && action.timestamp <= detectedAt,
    )
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((action) => ({
      actionId: action.id,
      step: describeActionReportStep(action),
    }));
  return refineActionStepEntries(eligible).slice(-limit);
}

function sameIssue(
  left: PotentialBugIssueRef,
  right: PotentialBugIssueRef,
): boolean {
  return left.category === right.category && left.issueId === right.issueId;
}

export function findBugForIssue(
  bugs: PotentialBug[],
  issue: PotentialBugIssueRef,
): PotentialBug | undefined {
  return bugs.find((bug) =>
    bug.issues.some((existing) => sameIssue(existing, issue)),
  );
}

export type DetectedIssueInput = {
  sessionId: string;
  issue: PotentialBugIssueRef;
  detectedAt: number;
  page: PotentialBugPage;
  actions: CapturedAction[];
};

export type ApplyDetectedIssueResult = {
  bugs: PotentialBug[];
  bug: PotentialBug | null;
  created: boolean;
};

export function applyDetectedIssue(
  bugs: PotentialBug[],
  input: DetectedIssueInput,
  createId: () => string,
): ApplyDetectedIssueResult {
  if (findBugForIssue(bugs, input.issue) !== undefined) {
    return { bugs, bug: null, created: false };
  }

  const pageKey = potentialBugPageKey(input.page);
  const groupTarget = [...bugs]
    .reverse()
    .find(
      (bug) =>
        bug.sessionId === input.sessionId &&
        potentialBugPageKey(bug.page) === pageKey &&
        input.detectedAt - bug.lastDetectedAt <=
          POTENTIAL_BUG_GROUPING_WINDOW_MS &&
        input.detectedAt >= bug.createdAt - POTENTIAL_BUG_GROUPING_WINDOW_MS,
    );

  if (groupTarget !== undefined) {
    const updated: PotentialBug = {
      ...groupTarget,
      lastDetectedAt: Math.max(groupTarget.lastDetectedAt, input.detectedAt),
      issues: [...groupTarget.issues, input.issue],
    };
    return {
      bugs: bugs.map((bug) => (bug.id === updated.id ? updated : bug)),
      bug: updated,
      created: false,
    };
  }

  const bug: PotentialBug = {
    id: createId(),
    sessionId: input.sessionId,
    createdAt: input.detectedAt,
    lastDetectedAt: input.detectedAt,
    source: 'automatic',
    page: input.page,
    actions: selectMeaningfulActions(
      input.actions,
      input.sessionId,
      input.detectedAt,
    ),
    issues: [input.issue],
    status: 'included',
  };
  return { bugs: [...bugs, bug], bug, created: true };
}

export type ManualBugInput = {
  sessionId: string;
  capturedAt: number;
  page: PotentialBugPage;
  actions: CapturedAction[];
  nearbyIssues: PotentialBugIssueRef[];
  note?: string;
};

export function createManualBug(
  bugs: PotentialBug[],
  input: ManualBugInput,
  createId: () => string,
): { bugs: PotentialBug[]; bug: PotentialBug } {
  const unattached = input.nearbyIssues.filter(
    (issue) => findBugForIssue(bugs, issue) === undefined,
  );
  const bug: PotentialBug = {
    id: createId(),
    sessionId: input.sessionId,
    createdAt: input.capturedAt,
    lastDetectedAt: input.capturedAt,
    source: 'manual',
    page: input.page,
    actions: selectMeaningfulActions(
      input.actions,
      input.sessionId,
      input.capturedAt,
    ),
    issues: unattached,
    status: 'included',
    ...(input.note !== undefined ? { note: input.note } : {}),
  };
  return { bugs: [...bugs, bug], bug };
}
