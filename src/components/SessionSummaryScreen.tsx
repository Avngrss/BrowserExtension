import { useMemo, useState } from 'react';
import { Button } from '@/src/components/Button';
import { PotentialBugCard } from '@/src/components/PotentialBugCard';
import { SessionConfirmDialog } from '@/src/components/SessionConfirmDialog';
import { describeActionReportStep } from '@/src/actions/action-report-steps';
import { refinePreviewActionSteps } from '@/src/actions/refine-preview-action-steps';
import type { CapturedAction } from '@/src/domain/action';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type {
  PotentialBug,
  PotentialBugStatus,
} from '@/src/domain/potential-bug';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import { isActiveSession } from '@/src/domain/session';
import type { UiIssue } from '@/src/domain/ui-issue';
import type { UseSessionStateResult } from '@/src/hooks/useSessionState';
import {
  buildPotentialBugDescription,
  countPotentialBugScreenshots,
} from '@/src/potential-bugs/potential-bug-description';
import {
  formatSessionDuration,
  getSessionDurationMs,
} from '@/src/sidepanel/session-display';

type SessionSummaryScreenProps = {
  session: UseSessionStateResult;
  actions: CapturedAction[];
  actionCount: number;
  finalizingScreenshots: boolean;
  potentialBugs: PotentialBug[];
  potentialBugsLoading?: boolean;
  uiIssues?: UiIssue[];
  consoleIssues?: ConsoleIssue[];
  networkIssues?: NetworkIssue[];
  screenshotEvidence?: ScreenshotEvidence[];
  onGeneratePrompt: (bugId: string) => void;
  onReviewIssues: () => void;
  onSetBugStatus: (bugId: string, status: PotentialBugStatus) => void;
  onStartNewCapture: () => void;
  onDeleteSession: () => void;
  replaceConfirm?: {
    onConfirm: () => void;
    onCancel: () => void;
  };
  deleteConfirm?: {
    onConfirm: () => void;
    onCancel: () => void;
  };
  summaryFeedback?: string;
};

function bugsCapturedHeadline(count: number): string {
  return `${count} potential ${count === 1 ? 'bug' : 'bugs'} captured`;
}

export function SessionSummaryScreen({
  session,
  actions,
  actionCount,
  finalizingScreenshots,
  potentialBugs,
  potentialBugsLoading = false,
  uiIssues = [],
  consoleIssues = [],
  networkIssues = [],
  screenshotEvidence = [],
  onGeneratePrompt,
  onReviewIssues,
  onSetBugStatus,
  onStartNewCapture,
  onDeleteSession,
  replaceConfirm,
  deleteConfirm,
  summaryFeedback,
}: SessionSummaryScreenProps) {
  const [activityExpanded, setActivityExpanded] = useState(false);

  const durationMs =
    isActiveSession(session.snapshot) && session.snapshot.status === 'stopped'
      ? getSessionDurationMs(session.snapshot, session.snapshot.stoppedAt)
      : null;
  const durationLabel =
    durationMs === null ? '—' : formatSessionDuration(durationMs);

  const sessionId = isActiveSession(session.snapshot)
    ? session.snapshot.id
    : null;
  const sessionBugs = useMemo(
    () => potentialBugs.filter((bug) => bug.sessionId === sessionId),
    [potentialBugs, sessionId],
  );
  const includedCount = sessionBugs.filter(
    (bug) => bug.status === 'included',
  ).length;

  const activitySteps = useMemo(
    () =>
      refinePreviewActionSteps(
        actions
          .filter((action) => action.sessionId === sessionId)
          .sort((left, right) => left.timestamp - right.timestamp)
          .map(describeActionReportStep),
      ),
    [actions, sessionId],
  );

  const issueLookup = { uiIssues, consoleIssues, networkIssues };
  const showStartNewCapture = replaceConfirm === undefined;

  return (
    <section
      aria-label="Session Summary"
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
          Session Summary
        </h2>
        <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          Reviewing
        </p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Duration {durationLabel}
        </p>
      </div>

      {finalizingScreenshots ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Finalizing screenshots…
        </p>
      ) : null}

      {summaryFeedback !== undefined ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {summaryFeedback}
        </p>
      ) : null}

      {potentialBugsLoading ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Loading session summary…
        </p>
      ) : sessionBugs.length === 0 ? (
        <section
          aria-label="Session result"
          className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
              Session completed
            </h3>
            <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">
              No potential bugs detected
            </p>
            <p className="mt-0.5 text-xs text-slate-600 tabular-nums dark:text-slate-300">
              {actionCount} recorded Actions
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            aria-expanded={activityExpanded}
            onClick={() => {
              setActivityExpanded((value) => !value);
            }}
          >
            {activityExpanded ? 'Hide activity' : 'View activity'}
          </Button>
          {activityExpanded ? (
            <div aria-label="Recorded activity" className="min-w-0">
              {activitySteps.length === 0 ? (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  No report-worthy actions were recorded.
                </p>
              ) : (
                <ol className="flex min-w-0 list-decimal flex-col gap-1 pl-4">
                  {activitySteps.map((step, index) => (
                    <li
                      key={`${index}-${step}`}
                      className="text-xs text-slate-700 dark:text-slate-200"
                    >
                      {step}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}
        </section>
      ) : (
        <section
          aria-label="Potential bugs"
          className="flex min-w-0 flex-col gap-3"
        >
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
            {bugsCapturedHeadline(includedCount)}
          </h3>
          {sessionBugs.map((bug, index) => (
            <PotentialBugCard
              key={bug.id}
              bug={bug}
              index={index}
              description={buildPotentialBugDescription(bug, issueLookup)}
              screenshotCount={countPotentialBugScreenshots(
                bug,
                screenshotEvidence,
              )}
              onGeneratePrompt={() => {
                onGeneratePrompt(bug.id);
              }}
              onReview={onReviewIssues}
              onSetStatus={(status) => {
                onSetBugStatus(bug.id, status);
              }}
            />
          ))}
        </section>
      )}

      {showStartNewCapture ? (
        <Button type="button" onClick={onStartNewCapture}>
          Start new capture
        </Button>
      ) : null}

      {replaceConfirm !== undefined ? (
        <SessionConfirmDialog
          title="Replace current session?"
          message="Starting a new capture will delete the current session data."
          confirmLabel="Start new capture"
          cancelLabel="Keep current session"
          processing={session.processing}
          onConfirm={replaceConfirm.onConfirm}
          onCancel={replaceConfirm.onCancel}
        />
      ) : null}

      {deleteConfirm !== undefined ? (
        <SessionConfirmDialog
          title="Delete this session?"
          message="This removes all actions, issues, dispositions, potential bugs, and screenshots from this session."
          confirmLabel="Delete session"
          cancelLabel="Keep current session"
          confirmVariant="danger"
          processing={session.processing}
          onConfirm={deleteConfirm.onConfirm}
          onCancel={deleteConfirm.onCancel}
        />
      ) : null}

      {deleteConfirm === undefined ? (
        <div className="flex min-w-0 flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <Button variant="danger" onClick={onDeleteSession}>
            Delete session
          </Button>
        </div>
      ) : null}

      {session.error !== undefined ? (
        <p role="alert" className="text-sm text-red-800 dark:text-red-200">
          {session.error}
        </p>
      ) : null}
    </section>
  );
}
