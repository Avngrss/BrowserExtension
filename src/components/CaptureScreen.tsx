import { useMemo } from 'react';
import type { TimelineEntry } from '@/src/domain/timeline-entry';
import { Button } from '@/src/components/Button';
import { CompactStatPair } from '@/src/components/CompactStatPair';
import { IssueCategoryCountsLine } from '@/src/components/IssueCategoryCountsLine';
import { RecentActivityList } from '@/src/components/RecentActivityList';
import { SessionControls } from '@/src/components/SessionControls';
import {
  CAPTURE_START_FAILED_MESSAGE,
  type CapturePhase,
} from '@/src/hooks/useCaptureReadiness';
import type { CaptureReadinessSnapshot } from '@/src/messaging/capture-readiness-types';
import { useSessionTicker } from '@/src/hooks/useSessionTicker';
import type { UseSessionStateResult } from '@/src/hooks/useSessionState';
import { isActiveSession } from '@/src/domain/session';
import {
  formatSessionDuration,
  getMonitoredHostname,
  getMonitoredPageTitle,
  formatMonitoredPagePath,
  getSessionDurationMs,
} from '@/src/sidepanel/session-display';

type CaptureScreenProps = {
  session: UseSessionStateResult;
  capturePhase: CapturePhase;
  readiness: CaptureReadinessSnapshot | null;
  startFailureMessage: string;
  onTryCaptureAgain: () => void;
  captureOnOtherTab: boolean;
  monitoredHostname: string | null;
  monitoredPageTitle: string | undefined;
  onGoToCapturedTab: () => void;
  actionCount: number;
  potentialIssues: number;
  uiIssueCount: number;
  consoleIssueCount: number;
  networkIssueCount: number;
  timelineEntries: TimelineEntry[];
  timelineError: string | undefined;
  timelineLoading: boolean;
};

function phaseHeading(
  phase: CapturePhase,
  startFailureMessage: string,
): string | null {
  switch (phase) {
    case 'starting':
      return 'Starting capture…';
    case 'capturing':
      return 'Capturing this tab';
    case 'reconnecting':
      return 'Reconnecting capture…';
    case 'paused':
      return 'Capture paused';
    case 'failed':
      return startFailureMessage || CAPTURE_START_FAILED_MESSAGE;
    default:
      return null;
  }
}

export function CaptureScreen({
  session,
  capturePhase,
  readiness,
  startFailureMessage,
  onTryCaptureAgain,
  captureOnOtherTab,
  monitoredHostname,
  monitoredPageTitle,
  onGoToCapturedTab,
  actionCount,
  potentialIssues,
  uiIssueCount,
  consoleIssueCount,
  networkIssueCount,
  timelineEntries,
  timelineError,
  timelineLoading,
}: CaptureScreenProps) {
  const tickerActive =
    session.status === 'recording' || session.status === 'paused';
  const now = useSessionTicker(tickerActive);

  const durationLabel = useMemo(() => {
    const durationMs = getSessionDurationMs(session.snapshot, now);
    if (durationMs === null) {
      return null;
    }
    return formatSessionDuration(durationMs);
  }, [now, session.snapshot]);

  const showTarget =
    isActiveSession(session.snapshot) &&
    (session.status === 'recording' || session.status === 'paused') &&
    capturePhase !== 'starting' &&
    capturePhase !== 'failed';

  const hostname =
    isActiveSession(session.snapshot) && showTarget
      ? getMonitoredHostname(session.snapshot)
      : null;
  const pageTitle =
    isActiveSession(session.snapshot) && showTarget
      ? getMonitoredPageTitle(session.snapshot)
      : undefined;
  const pagePathLabel =
    isActiveSession(session.snapshot) && showTarget
      ? formatMonitoredPagePath(session.snapshot)
      : null;

  const heading = captureOnOtherTab
    ? 'Capture is running in another tab'
    : phaseHeading(capturePhase, startFailureMessage);

  return (
    <section aria-label="Capture" className="flex min-w-0 flex-col gap-3">
      {heading !== null ? (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
            {heading}
          </p>
          {captureOnOtherTab ? (
            <>
              {monitoredHostname !== null ? (
                <p className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
                  {monitoredHostname}
                </p>
              ) : null}
              {monitoredPageTitle !== undefined ? (
                <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
                  Page title: {monitoredPageTitle}
                </p>
              ) : null}
            </>
          ) : (
            <>
              {hostname !== null &&
              (capturePhase === 'capturing' ||
                capturePhase === 'paused' ||
                capturePhase === 'reconnecting') ? (
                <p className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
                  {capturePhase === 'paused'
                    ? hostname
                    : `Capturing ${hostname}`}
                </p>
              ) : null}
              {pageTitle !== undefined ? (
                <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
                  Page title: {pageTitle}
                </p>
              ) : null}
              {pagePathLabel !== null &&
              (capturePhase === 'capturing' ||
                capturePhase === 'paused' ||
                capturePhase === 'reconnecting') ? (
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {pagePathLabel}
                </p>
              ) : null}
            </>
          )}
          {durationLabel !== null &&
          (capturePhase === 'capturing' ||
            capturePhase === 'paused' ||
            capturePhase === 'reconnecting') ? (
            <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
              Elapsed {durationLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      {captureOnOtherTab ? (
        <Button variant="secondary" type="button" onClick={onGoToCapturedTab}>
          Go to captured tab
        </Button>
      ) : null}

      {capturePhase === 'failed' ? (
        <Button type="button" onClick={onTryCaptureAgain}>
          Try again
        </Button>
      ) : null}

      <SessionControls
        status={session.status}
        loading={session.loading}
        processing={session.processing}
        onStart={() => {
          void session.start();
        }}
        onPause={() => {
          void session.pause();
        }}
        onResume={() => {
          void session.resume();
        }}
        onStop={() => {
          void session.stop();
        }}
      />

      {session.processing ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Updating session…
        </p>
      ) : null}
      {session.error !== undefined ? (
        <p role="alert" className="text-sm text-red-800 dark:text-red-200">
          {session.error}
        </p>
      ) : null}

      {import.meta.env.DEV && readiness !== null ? (
        <details className="rounded border border-slate-200 p-2 text-xs dark:border-slate-700">
          <summary className="cursor-pointer font-medium">
            Capture status
          </summary>
          <ul className="mt-2 space-y-1">
            <li>
              Actions: {readiness.collectors.actions ? 'Ready' : 'Not ready'}
            </li>
            <li>UI: {readiness.collectors.ui ? 'Ready' : 'Not ready'}</li>
            <li>
              Console: {readiness.collectors.console ? 'Ready' : 'Not ready'}
            </li>
            <li>
              Network: {readiness.collectors.network ? 'Ready' : 'Not ready'}
            </li>
          </ul>
        </details>
      ) : null}

      <CompactStatPair
        actions={actionCount}
        potentialIssues={potentialIssues}
      />

      {potentialIssues > 0 ? (
        <IssueCategoryCountsLine
          uiCount={uiIssueCount}
          consoleCount={consoleIssueCount}
          networkCount={networkIssueCount}
        />
      ) : null}

      <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
        Actions and potential issues are captured automatically while you
        explore the page. Only new events after Start are captured. Browser
        warnings and earlier DevTools history are not included.
      </p>

      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
          Recent activity
        </h2>
        {timelineError !== undefined ? (
          <p role="alert" className="text-sm text-red-800 dark:text-red-200">
            {timelineError}
          </p>
        ) : null}
        {!timelineLoading ? (
          <RecentActivityList entries={timelineEntries} limit={5} />
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Loading activity…
          </p>
        )}
      </div>
    </section>
  );
}
