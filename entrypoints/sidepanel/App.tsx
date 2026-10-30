import { useCallback, useMemo, useState, useEffect } from 'react';
import { isActiveSession } from '@/src/domain/session';
import { useActiveTabInWindow } from '@/src/hooks/useActiveTabInWindow';
import {
  getMonitoredHostname,
  getMonitoredPageTitle,
} from '@/src/sidepanel/session-display';
import { Button } from '@/src/components/Button';
import { CaptureScreen } from '@/src/components/CaptureScreen';
import { IssueReviewScreen } from '@/src/components/IssueReviewScreen';
import { PotentialBugPromptScreen } from '@/src/components/PotentialBugPromptScreen';
import { SessionSummaryScreen } from '@/src/components/SessionSummaryScreen';
import type {
  IssueDisposition,
  IssueReviewCategory,
} from '@/src/domain/issue-disposition';
import { mergeTimelineEntries } from '@/src/domain/timeline-entry';
import { useActionList } from '@/src/hooks/useActionList';
import { useConsoleIssueList } from '@/src/hooks/useConsoleIssueList';
import { useNetworkIssueList } from '@/src/hooks/useNetworkIssueList';
import { useCaptureReadiness } from '@/src/hooks/useCaptureReadiness';
import { useSessionState } from '@/src/hooks/useSessionState';
import { useSidePanelView } from '@/src/hooks/useSidePanelView';
import { useUiIssueList } from '@/src/hooks/useUiIssueList';
import { useScreenshotEvidence } from '@/src/hooks/useScreenshotEvidence';
import { usePotentialBugs } from '@/src/hooks/usePotentialBugs';
import { countPotentialIssues } from '@/src/sidepanel/session-display';
import { sessionHasPreservedData } from '@/src/sessions/session-preserved-data';
import { extensionBrowser } from '@/src/utils/browser-client';
import {
  ISSUE_DISPOSITION_UPDATE_FAILED_MESSAGE,
  issueDispositionClient,
} from '@/src/utils/issue-disposition-client';
import {
  SETTINGS_OPEN_FAILED_MESSAGE,
  toInlineError,
} from '@/src/utils/extension-pages';
import { PRODUCT_NAME } from '@/src/utils/product';

export function App() {
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [summaryFeedback, setSummaryFeedback] = useState<string | undefined>(
    undefined,
  );
  const [pendingReplaceConfirm, setPendingReplaceConfirm] = useState(false);
  const [pendingDeleteConfirm, setPendingDeleteConfirm] = useState(false);
  const session = useSessionState();
  const activeTabId = useActiveTabInWindow();
  const captureReadiness = useCaptureReadiness({
    snapshot: session.snapshot,
    status: session.status,
  });
  const { view, promptBugId, openReview, openPrompt, backToSummary } =
    useSidePanelView(session.status, session.loading);

  const actionList = useActionList();
  const consoleIssueList = useConsoleIssueList();
  const networkIssueList = useNetworkIssueList();
  const uiIssueList = useUiIssueList();
  const screenshotEvidence = useScreenshotEvidence();
  const potentialBugList = usePotentialBugs();
  const sessionPotentialBugs = useMemo(
    () =>
      isActiveSession(session.snapshot)
        ? potentialBugList.bugs.filter(
            (bug) =>
              isActiveSession(session.snapshot) &&
              bug.sessionId === session.snapshot.id,
          )
        : [],
    [potentialBugList.bugs, session.snapshot],
  );

  const timelineEntries = useMemo(
    () =>
      mergeTimelineEntries(
        actionList.actions,
        consoleIssueList.issues,
        networkIssueList.issues,
        uiIssueList.issues,
      ),
    [
      actionList.actions,
      consoleIssueList.issues,
      networkIssueList.issues,
      uiIssueList.issues,
    ],
  );

  const timelineError =
    actionList.error ??
    consoleIssueList.error ??
    networkIssueList.error ??
    uiIssueList.error;
  const timelineLoading =
    actionList.loading ||
    consoleIssueList.loading ||
    networkIssueList.loading ||
    uiIssueList.loading;

  const actionCount = actionList.loading ? 0 : actionList.actions.length;
  const uiCount = uiIssueList.loading ? 0 : uiIssueList.issues.length;
  const consoleCount = consoleIssueList.loading
    ? 0
    : consoleIssueList.issues.length;
  const networkCount = networkIssueList.loading
    ? 0
    : networkIssueList.issues.length;
  const potentialIssues = countPotentialIssues({
    ui: uiCount,
    console: consoleCount,
    network: networkCount,
  });

  const handleIssueDispositionChange = useCallback(
    (input: {
      category: IssueReviewCategory;
      issueId: string;
      disposition: IssueDisposition;
    }) => {
      setNotice(undefined);
      void issueDispositionClient
        .setIssueDisposition(input)
        .then((response) => {
          if (!response.ok) {
            setNotice(ISSUE_DISPOSITION_UPDATE_FAILED_MESSAGE);
          }
        });
    },
    [],
  );

  const handleBulkDisposition = useCallback(
    (input: {
      category: IssueReviewCategory | 'all';
      disposition: IssueDisposition;
    }) => {
      setNotice(undefined);
      void issueDispositionClient.setBulkDisposition(input).then((response) => {
        if (!response.ok) {
          setNotice(ISSUE_DISPOSITION_UPDATE_FAILED_MESSAGE);
        }
      });
    },
    [],
  );

  const captureOnOtherTab = useMemo(() => {
    if (!isActiveSession(session.snapshot)) {
      return false;
    }
    if (session.status !== 'recording' && session.status !== 'paused') {
      return false;
    }
    if (activeTabId === null) {
      return false;
    }
    return activeTabId !== session.snapshot.targetTabId;
  }, [activeTabId, session.snapshot, session.status]);

  const monitoredHostname = useMemo(() => {
    if (!isActiveSession(session.snapshot)) {
      return null;
    }
    return getMonitoredHostname(session.snapshot);
  }, [session.snapshot]);

  const monitoredPageTitle = useMemo(() => {
    if (!isActiveSession(session.snapshot)) {
      return undefined;
    }
    return getMonitoredPageTitle(session.snapshot);
  }, [session.snapshot]);

  function handleGoToCapturedTab(): void {
    setNotice(undefined);
    if (!isActiveSession(session.snapshot)) {
      return;
    }
    void extensionBrowser
      .activateTab(session.snapshot.targetTabId)
      .catch((error: unknown) => {
        setNotice(
          toInlineError(error, 'Could not switch to the captured tab.'),
        );
      });
  }

  function handleOpenSettings(): void {
    setNotice(undefined);
    void extensionBrowser.openOptionsPage().catch((error: unknown) => {
      setNotice(toInlineError(error, SETTINGS_OPEN_FAILED_MESSAGE));
    });
  }

  useEffect(() => {
    if (session.status !== 'stopped') {
      setPendingReplaceConfirm(false);
      setPendingDeleteConfirm(false);
    }
  }, [session.status]);

  const hasPreservedData = sessionHasPreservedData({
    actionCount,
    potentialIssues,
    capturedFrames: screenshotEvidence.capturedFrameCount,
    pendingFrames: screenshotEvidence.pendingFrameCount,
    hasMark: sessionPotentialBugs.length > 0,
  });

  const captureBugEnabled =
    isActiveSession(session.snapshot) &&
    (session.status === 'recording' || session.status === 'paused');

  const { captureBugNow, setStatus: setPotentialBugStatus } = potentialBugList;
  const handleCaptureBug = useCallback(
    async (input: { note?: string }) => {
      const response = await captureBugNow(input);
      if (!response.ok) {
        return { ok: false as const, message: response.error.message };
      }
      return { ok: true as const };
    },
    [captureBugNow],
  );

  function handleStartNewCapture(): void {
    setNotice(undefined);
    setSummaryFeedback(undefined);
    if (session.status === 'stopped' && hasPreservedData) {
      setPendingReplaceConfirm(true);
      setPendingDeleteConfirm(false);
      return;
    }
    void session.startNewCapture();
  }

  function handleConfirmReplaceSession(): void {
    setNotice(undefined);
    void session.startNewCapture().finally(() => {
      setPendingReplaceConfirm(false);
    });
  }

  function handleDeleteSessionRequest(): void {
    setNotice(undefined);
    setPendingReplaceConfirm(false);
    setPendingDeleteConfirm(true);
  }

  function handleConfirmDeleteSession(): void {
    setNotice(undefined);
    void session.deleteSession().finally(() => {
      setPendingDeleteConfirm(false);
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl min-w-0 flex-col gap-4 overflow-x-hidden p-3">
      <header className="flex min-w-0 items-center justify-between gap-2">
        <h1 className="min-w-0 truncate text-lg font-semibold text-slate-950 dark:text-slate-50">
          {PRODUCT_NAME}
        </h1>
        <Button
          variant="secondary"
          fullWidth={false}
          aria-label="Settings"
          onClick={handleOpenSettings}
        >
          Settings
        </Button>
      </header>

      {view === 'capture' ? (
        <CaptureScreen
          session={session}
          capturePhase={captureReadiness.phase}
          readiness={captureReadiness.readiness}
          startFailureMessage={captureReadiness.startFailureMessage}
          onTryCaptureAgain={captureReadiness.tryAgain}
          captureOnOtherTab={captureOnOtherTab}
          monitoredHostname={monitoredHostname}
          monitoredPageTitle={monitoredPageTitle}
          onGoToCapturedTab={handleGoToCapturedTab}
          actionCount={actionCount}
          potentialIssues={potentialIssues}
          uiIssueCount={uiCount}
          consoleIssueCount={consoleCount}
          networkIssueCount={networkCount}
          timelineEntries={timelineEntries}
          timelineError={timelineError}
          timelineLoading={timelineLoading}
          captureBugEnabled={captureBugEnabled}
          onCaptureBug={handleCaptureBug}
        />
      ) : null}

      {view === 'summary' ? (
        <SessionSummaryScreen
          session={session}
          actions={actionList.actions}
          actionCount={actionCount}
          finalizingScreenshots={screenshotEvidence.finalizingScreenshots}
          potentialBugs={sessionPotentialBugs}
          potentialBugsLoading={potentialBugList.loading}
          uiIssues={uiIssueList.issues}
          consoleIssues={consoleIssueList.issues}
          networkIssues={networkIssueList.issues}
          screenshotEvidence={screenshotEvidence.evidence}
          onGeneratePrompt={openPrompt}
          onReviewIssues={openReview}
          onSetBugStatus={(bugId, status) => {
            void setPotentialBugStatus(bugId, status);
          }}
          onStartNewCapture={handleStartNewCapture}
          onDeleteSession={handleDeleteSessionRequest}
          replaceConfirm={
            pendingReplaceConfirm
              ? {
                  onConfirm: handleConfirmReplaceSession,
                  onCancel: () => {
                    setPendingReplaceConfirm(false);
                    setSummaryFeedback('Current session kept.');
                  },
                }
              : undefined
          }
          summaryFeedback={summaryFeedback}
          deleteConfirm={
            pendingDeleteConfirm
              ? {
                  onConfirm: handleConfirmDeleteSession,
                  onCancel: () => {
                    setPendingDeleteConfirm(false);
                  },
                }
              : undefined
          }
        />
      ) : null}

      {view === 'prompt' ? (
        <PotentialBugPromptScreen
          potentialBugs={sessionPotentialBugs}
          bugId={promptBugId}
          uiIssues={uiIssueList.issues}
          consoleIssues={consoleIssueList.issues}
          networkIssues={networkIssueList.issues}
          screenshotEvidence={screenshotEvidence.evidence}
          onBack={backToSummary}
        />
      ) : null}

      {view === 'review' ? (
        <IssueReviewScreen
          uiIssues={uiIssueList.issues}
          consoleIssues={consoleIssueList.issues}
          networkIssues={networkIssueList.issues}
          loading={timelineLoading}
          error={timelineError ?? notice}
          onBack={backToSummary}
          onDispositionChange={handleIssueDispositionChange}
          onBulkDisposition={handleBulkDisposition}
          screenshotEvidence={screenshotEvidence.evidence}
          onRemoveScreenshot={screenshotEvidence.removeScreenshot}
          onDeleteSession={handleDeleteSessionRequest}
          deleteConfirm={
            pendingDeleteConfirm
              ? {
                  onConfirm: handleConfirmDeleteSession,
                  onCancel: () => {
                    setPendingDeleteConfirm(false);
                  },
                }
              : undefined
          }
          processing={session.processing}
        />
      ) : null}

      {notice !== undefined && view !== 'review' ? (
        <p role="alert" className="text-sm text-red-800 dark:text-red-200">
          {notice}
        </p>
      ) : null}
    </main>
  );
}
