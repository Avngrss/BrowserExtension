import {
  handleBackgroundMessage,
  shouldBroadcastSessionUpdate,
} from '@/src/messaging/background-router';
import {
  createActionListUpdatedMessage,
  shouldBroadcastActionUpdate,
} from '@/src/messaging/action-messages';
import { createSessionStateUpdatedMessage } from '@/src/messaging/session-messages';
import { ActionStore } from '@/src/actions/action-store';
import { createBrowserActionStorage } from '@/src/actions/action-storage';
import { ConsoleIssueStore } from '@/src/console/console-issue-store';
import { createBrowserConsoleIssueStorage } from '@/src/console/console-issue-storage';
import { NetworkIssueStore } from '@/src/network/network-issue-store';
import { createBrowserNetworkIssueStorage } from '@/src/network/network-issue-storage';
import {
  createConsoleIssueListUpdatedMessage,
  shouldBroadcastConsoleIssueUpdate,
} from '@/src/messaging/console-issue-messages';
import {
  createNetworkIssueListUpdatedMessage,
  shouldBroadcastNetworkIssueUpdate,
} from '@/src/messaging/network-issue-messages';
import { UiIssueStore } from '@/src/ui/ui-issue-store';
import { createBrowserUiIssueStorage } from '@/src/ui/ui-issue-storage';
import { UiRuleStore } from '@/src/ui/ui-rule-store';
import { createBrowserUiRuleStorage } from '@/src/ui/ui-rule-storage';
import {
  createUiIssueListUpdatedMessage,
  shouldBroadcastUiIssueUpdate,
} from '@/src/messaging/ui-issue-messages';
import {
  createUiRulesUpdatedMessage,
  shouldBroadcastUiRulesUpdate,
} from '@/src/messaging/ui-rule-messages';
import {
  issueDispositionBroadcastTargetsForMessage,
  shouldBroadcastIssueDispositionUpdate,
} from '@/src/messaging/issue-disposition-messages';
import { isActiveSession } from '@/src/domain/session';
import { createDefaultSessionStore } from '@/src/sessions/in-memory-session-store';
import { PersistentSessionStore } from '@/src/sessions/persistent-session-store';
import { SessionRevisionTracker } from '@/src/sessions/session-revision';
import { createBrowserSessionStorage } from '@/src/sessions/session-storage';
import { createBrowserSessionTabResolver } from '@/src/sessions/session-tab-resolver';
import { CaptureReadinessStore } from '@/src/sessions/capture-readiness-store';
import { createCaptureReadinessUpdatedMessage } from '@/src/messaging/capture-readiness-messages';
import { shouldBroadcastPageContextUpdate } from '@/src/messaging/page-context-messages';
import { sanitizeUrl } from '@/src/privacy/url-sanitizer';
import { ensureTargetTabContentBootstrap } from '@/src/sessions/content-tab-bootstrap';
import { deliverSessionStateToTargetTab } from '@/src/sessions/target-tab-session-sync';
import { ExtensionSettingsService } from '@/src/settings/extension-settings-service';
import { EXTENSION_SETTINGS_STORAGE_KEY } from '@/src/settings/extension-settings';
import { EXTENSION_SETTINGS_UPDATED } from '@/src/messaging/extension-settings-messages';
import { createBrowserScreenshotIdb } from '@/src/screenshots/screenshot-idb';
import { ScreenshotEvidenceStore } from '@/src/screenshots/screenshot-evidence-store';
import { ScreenshotCaptureQueue } from '@/src/screenshots/screenshot-capture-queue';
import { ScreenshotCaptureService } from '@/src/screenshots/screenshot-capture-service';
import { createScreenshotEvidenceUpdatedMessage } from '@/src/messaging/screenshot-evidence-messages';
import type { NewUniqueIssueEvent } from '@/src/domain/new-unique-issue';
import { createBackgroundCaptureIndicators } from '@/src/background/capture-indicators-runtime';
import { IssueMarkStore } from '@/src/issue-marks/issue-mark-store';
import { createBrowserIssueMarkStorage } from '@/src/issue-marks/issue-mark-storage';
import { broadcastIssueMarkUpdated } from '@/src/messaging/issue-mark-messages';
import { BugReportContextStore } from '@/src/bug-report/bug-report-context-store';
import { createBrowserBugReportContextStorage } from '@/src/bug-report/bug-report-context-storage';
import { broadcastBugReportContextToRuntime } from '@/src/messaging/bug-report-context-messages';
import { PotentialBugStore } from '@/src/potential-bugs/potential-bug-store';
import { createBrowserPotentialBugStorage } from '@/src/potential-bugs/potential-bug-storage';
import { createPotentialBugCoordinator } from '@/src/potential-bugs/potential-bug-coordinator';
import { buildPotentialBugDescription } from '@/src/potential-bugs/potential-bug-description';
import { POTENTIAL_BUGS_UPDATED } from '@/src/messaging/potential-bug-types';
import { logDev } from '@/src/utils/dev-log';
import { browser } from 'wxt/browser';

export default defineBackground(() => {
  logDev('Bug Capture Assistant background started.');

  if (browser.sidePanel?.setPanelBehavior !== undefined) {
    void browser.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(() => undefined);
  }

  const settingsService = new ExtensionSettingsService();
  void settingsService.waitUntilReady();

  function sanitizeTabUrl(rawUrl: string): string | null {
    const privacy = settingsService.getPrivacy();
    return sanitizeUrl(rawUrl, {
      redactSensitiveUrlParameters: privacy.redactSensitiveUrlParameters,
      removeUrlHash: privacy.removeUrlHash,
    });
  }

  const memory = createDefaultSessionStore();
  const sessionRevision = new SessionRevisionTracker();
  const screenshotIdb = createBrowserScreenshotIdb();
  const screenshotStore = new ScreenshotEvidenceStore(screenshotIdb);

  function broadcastScreenshotEvidence(): void {
    const state = memory.getState();
    const sessionId = isActiveSession(state) ? state.id : undefined;
    const evidence =
      sessionId === undefined
        ? []
        : screenshotStore.getRecordsForSession(sessionId);
    const message = createScreenshotEvidenceUpdatedMessage(evidence);
    void browser.runtime.sendMessage(message).catch(() => undefined);
  }

  const screenshotQueue = new ScreenshotCaptureQueue(screenshotStore, {
    getSessionState: () => memory.getState(),
    getSettings: () => settingsService.getScreenshotSettings(),
    sanitizePageUrl: sanitizeTabUrl,
    createScreenshotId: () => crypto.randomUUID(),
    onEvidenceChanged: broadcastScreenshotEvidence,
  });
  const screenshotCapture = new ScreenshotCaptureService(screenshotQueue);
  const issueMarkStore = new IssueMarkStore(createBrowserIssueMarkStorage());
  const bugReportContextStore = new BugReportContextStore(
    createBrowserBugReportContextStorage(),
  );

  function broadcastIssueMark(): void {
    broadcastIssueMarkUpdated(issueMarkStore.getData());
  }

  function broadcastBugReportContext(): void {
    const state = memory.getState();
    const context =
      isActiveSession(state) && state.status === 'stopped'
        ? bugReportContextStore.getContextForSession(state.id)
        : null;
    broadcastBugReportContextToRuntime(context);
  }

  let dispatchNewUniqueIssue: (event: NewUniqueIssueEvent) => void = () =>
    undefined;
  function onNewUniqueIssue(event: NewUniqueIssueEvent): void {
    dispatchNewUniqueIssue(event);
  }

  const actionStore = new ActionStore(createBrowserActionStorage(), {
    getSessionState: () => memory.getState(),
    createActionId: () => crypto.randomUUID(),
    getMaxStoredActions: () => settingsService.getLimits().maxActionsPerSession,
  });
  const consoleIssueStore = new ConsoleIssueStore(
    createBrowserConsoleIssueStorage(),
    {
      getSessionState: () => memory.getState(),
      createIssueId: () => crypto.randomUUID(),
      getMaxStoredIssues: () =>
        settingsService.getLimits().maxUniqueConsoleIssues,
      onNewUniqueIssue,
    },
  );
  const networkIssueStore = new NetworkIssueStore(
    createBrowserNetworkIssueStorage(),
    {
      getSessionState: () => memory.getState(),
      createIssueId: () => crypto.randomUUID(),
      getMaxStoredIssues: () =>
        settingsService.getLimits().maxUniqueNetworkIssues,
      onNewUniqueIssue,
    },
  );
  const uiRuleStore = new UiRuleStore(createBrowserUiRuleStorage());
  const uiIssueStore = new UiIssueStore(createBrowserUiIssueStorage(), {
    getSessionState: () => memory.getState(),
    createIssueId: () => crypto.randomUUID(),
    ruleStore: uiRuleStore,
    getMaxStoredIssues: () => settingsService.getLimits().maxUniqueUiIssues,
    onNewUniqueIssue,
  });

  const captureIndicators = createBackgroundCaptureIndicators({
    settingsService,
    getSessionState: () => memory.getState(),
    getIssueCounts: () => ({
      ui: uiIssueStore.getIssues().length,
      console: consoleIssueStore.getIssues().length,
      network: networkIssueStore.getIssues().length,
    }),
  });
  function refreshCaptureIndicators(): void {
    captureIndicators.syncBadge();
  }

  const potentialBugStore = new PotentialBugStore(
    createBrowserPotentialBugStorage(),
    () => crypto.randomUUID(),
  );

  function broadcastPotentialBugs(): void {
    const state = memory.getState();
    const bugs = isActiveSession(state)
      ? potentialBugStore.getBugsForSession(state.id)
      : [];
    void browser.runtime
      .sendMessage({ type: POTENTIAL_BUGS_UPDATED, bugs })
      .catch(() => undefined);
  }

  function currentIssueLookup() {
    return {
      uiIssues: uiIssueStore.getIssues(),
      consoleIssues: consoleIssueStore.getIssues(),
      networkIssues: networkIssueStore.getIssues(),
    };
  }

  const potentialBugCoordinator = createPotentialBugCoordinator({
    store: potentialBugStore,
    getSessionState: () => memory.getState(),
    sanitizePageUrl: sanitizeTabUrl,
    getActions: () => actionStore.getActions(),
    getIssues: currentIssueLookup,
    now: () => Date.now(),
    onBugCreated: ({ bug, issueCategory }) => {
      captureIndicators.notifyPotentialBugCreated({
        issueCategory,
        description: buildPotentialBugDescription(bug, currentIssueLookup()),
      });
    },
    onBugsChanged: broadcastPotentialBugs,
    requestManualScreenshot: (bugId) => {
      void screenshotCapture.requestCaptureForBug(bugId).catch(() => undefined);
    },
  });

  dispatchNewUniqueIssue = (event: NewUniqueIssueEvent): void => {
    void screenshotCapture.onNewUniqueIssue(event);
    void potentialBugCoordinator
      .handleNewUniqueIssue(event)
      .catch(() => undefined);
    refreshCaptureIndicators();
  };

  const captureReadinessStore = new CaptureReadinessStore();

  function broadcastEmptySessionData(): void {
    broadcastActionList();
    broadcastConsoleIssueList();
    broadcastNetworkIssueList();
    broadcastUiIssueList();
    broadcastScreenshotEvidence();
  }

  async function clearSessionArtifacts(
    sessionId: string | null,
  ): Promise<void> {
    if (sessionId !== null) {
      screenshotCapture.discardSession(sessionId);
    }
    await actionStore.clearActions();
    await consoleIssueStore.clearIssues();
    await networkIssueStore.clearIssues();
    await uiIssueStore.clearIssues();
    await screenshotStore.clearSession();
    await issueMarkStore.clear();
    await bugReportContextStore.clear();
    await potentialBugStore.clear();
    broadcastEmptySessionData();
    broadcastPotentialBugs();
    broadcastIssueMark();
    broadcastBugReportContext();
    captureIndicators.clearBadge();
  }

  const sessionBackend = new PersistentSessionStore(
    memory,
    createBrowserSessionStorage(),
    {
      tabResolver: createBrowserSessionTabResolver(),
      ensureTargetTabReady: (tabId) => ensureTargetTabContentBootstrap(tabId),
      clearSessionArtifacts,
      onSessionStarted: async (nextState) => {
        captureReadinessStore.reset();
        broadcastCaptureReadiness();
        if (isActiveSession(nextState)) {
          screenshotCapture.onNewSession(nextState.id);
        }
        await rebroadcastSessionToTargetTab();
      },
      onSessionStopped: () => {
        screenshotCapture.onRecordingStopped();
        return Promise.resolve();
      },
      onSessionDeletedOnTab: async ({ tabId, state, revision }) => {
        captureReadinessStore.reset();
        broadcastCaptureReadiness();
        const message = createSessionStateUpdatedMessage(state, revision);
        await deliverSessionStateToTargetTab(tabId, message);
      },
      revisionTracker: sessionRevision,
    },
  );

  function broadcastSettingsUpdated(): void {
    const message = {
      type: EXTENSION_SETTINGS_UPDATED,
      settings: settingsService.getSettings(),
    };
    void browser.runtime.sendMessage(message).catch(() => undefined);
    void browser.tabs
      .query({ url: ['http://*/*', 'https://*/*'] })
      .then((tabs) => {
        for (const tab of tabs) {
          if (tab.id === undefined) {
            continue;
          }
          void browser.tabs.sendMessage(tab.id, message).catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }
    if (!(EXTENSION_SETTINGS_STORAGE_KEY in changes)) {
      return;
    }
    void settingsService.reload().then(() => {
      broadcastSettingsUpdated();
    });
  });

  function broadcastCaptureReadiness(): void {
    const message = createCaptureReadinessUpdatedMessage(
      captureReadinessStore.getSnapshot(),
    );
    void browser.runtime.sendMessage(message).catch(() => undefined);
  }

  function getExpectedRecordingSession(): {
    sessionId: string | undefined;
    revision: number;
  } {
    const state = memory.getState();
    if (!isActiveSession(state) || state.status !== 'recording') {
      return { sessionId: undefined, revision: sessionRevision.getRevision() };
    }
    return {
      sessionId: state.id,
      revision: sessionRevision.getRevision(),
    };
  }

  async function rebroadcastSessionToTargetTab(): Promise<void> {
    const state = memory.getState();
    const revision = sessionRevision.getRevision();
    const message = createSessionStateUpdatedMessage(state, revision);
    void browser.runtime.sendMessage(message).catch(() => undefined);
    if (isActiveSession(state)) {
      await deliverSessionStateToTargetTab(state.targetTabId, message);
    }
  }

  function broadcastSessionState(): void {
    const state = memory.getState();
    const message = createSessionStateUpdatedMessage(
      state,
      sessionRevision.getRevision(),
    );

    void browser.runtime.sendMessage(message).catch(() => undefined);

    if (isActiveSession(state)) {
      void browser.tabs
        .sendMessage(state.targetTabId, message)
        .catch(() => undefined);
    }
  }

  function broadcastActionList(): void {
    void browser.runtime
      .sendMessage(createActionListUpdatedMessage(actionStore.getActions()))
      .catch(() => undefined);
  }

  function broadcastConsoleIssueList(): void {
    void browser.runtime
      .sendMessage(
        createConsoleIssueListUpdatedMessage(consoleIssueStore.getIssues()),
      )
      .catch(() => undefined);
  }

  function broadcastNetworkIssueList(): void {
    void browser.runtime
      .sendMessage(
        createNetworkIssueListUpdatedMessage(networkIssueStore.getIssues()),
      )
      .catch(() => undefined);
  }

  function broadcastUiIssueList(): void {
    void browser.runtime
      .sendMessage(createUiIssueListUpdatedMessage(uiIssueStore.getIssues()))
      .catch(() => undefined);
  }

  function broadcastUiRules(): void {
    const message = createUiRulesUpdatedMessage(uiRuleStore.getRules());
    void browser.runtime.sendMessage(message).catch(() => undefined);

    const state = memory.getState();
    if (isActiveSession(state)) {
      void browser.tabs
        .sendMessage(state.targetTabId, message)
        .catch(() => undefined);
    }
  }

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const state = memory.getState();
    if (!isActiveSession(state) || tabId !== state.targetTabId) {
      return;
    }

    if (changeInfo.status === 'loading') {
      captureReadinessStore.setReconnecting(
        state.id,
        sessionRevision.getRevision(),
        tabId,
        true,
      );
      broadcastCaptureReadiness();
    }

    const nextUrl =
      changeInfo.url !== undefined ? sanitizeTabUrl(changeInfo.url) : null;
    const url =
      nextUrl ?? (tab.url !== undefined ? sanitizeTabUrl(tab.url) : null);
    if (url === null) {
      return;
    }

    if (changeInfo.url !== undefined || changeInfo.title !== undefined) {
      void sessionBackend
        .updatePageContext(
          {
            url,
            pageTitle: tab.title,
            updatedAt: Date.now(),
          },
          tabId,
        )
        .then((response) => {
          if (response.ok) {
            broadcastSessionState();
          }
        })
        .catch(() => undefined);
    }
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void handleBackgroundMessage(
      message,
      sessionBackend,
      actionStore,
      consoleIssueStore,
      networkIssueStore,
      uiIssueStore,
      uiRuleStore,
      sender.tab?.id,
      {
        readinessStore: captureReadinessStore,
        settingsService,
        screenshotStore,
        screenshotCapture,
        getExpectedRecordingSession,
        getActiveSessionId: () => {
          const state = memory.getState();
          return isActiveSession(state) ? state.id : undefined;
        },
        broadcastCaptureReadiness,
        broadcastScreenshotEvidence,
        rebroadcastSessionToTargetTab,
        issueMarkStore,
        sanitizePageUrl: sanitizeTabUrl,
        broadcastIssueMark,
        getSessionSnapshot: () => memory.getState(),
        bugReportContextStore,
        broadcastBugReportContext,
        potentialBugs: {
          store: potentialBugStore,
          coordinator: potentialBugCoordinator,
          getActiveSessionId: () => {
            const state = memory.getState();
            return isActiveSession(state) ? state.id : undefined;
          },
          broadcastPotentialBugs,
        },
      },
    ).then((response) => {
      if (response === undefined) {
        return;
      }

      if (shouldBroadcastSessionUpdate(message, response)) {
        captureReadinessStore.reset();
        if (response.state.status === 'recording') {
          void rebroadcastSessionToTargetTab();
        } else {
          broadcastSessionState();
        }
        broadcastCaptureReadiness();
        refreshCaptureIndicators();
      }

      if (
        shouldBroadcastPageContextUpdate(
          response as import('@/src/messaging/session-types').SessionResponse,
        )
      ) {
        broadcastSessionState();
      }

      if (shouldBroadcastActionUpdate(message, response)) {
        broadcastActionList();
      }

      if (shouldBroadcastConsoleIssueUpdate(message, response)) {
        broadcastConsoleIssueList();
        refreshCaptureIndicators();
      }

      if (shouldBroadcastNetworkIssueUpdate(message, response)) {
        broadcastNetworkIssueList();
        refreshCaptureIndicators();
      }

      if (shouldBroadcastUiIssueUpdate(message, response)) {
        broadcastUiIssueList();
        refreshCaptureIndicators();
      }

      if (shouldBroadcastUiRulesUpdate(message, response)) {
        broadcastUiRules();
      }

      if (shouldBroadcastIssueDispositionUpdate(message, response)) {
        const targets = issueDispositionBroadcastTargetsForMessage(message);
        if (targets !== null) {
          if (targets.consoleUpdated) {
            broadcastConsoleIssueList();
          }
          if (targets.networkUpdated) {
            broadcastNetworkIssueList();
          }
          if (targets.uiUpdated) {
            broadcastUiIssueList();
          }
        }
      }

      sendResponse(response);
    });

    return true;
  });

  void settingsService.waitUntilReady().then(() => {
    refreshCaptureIndicators();
  });
});
