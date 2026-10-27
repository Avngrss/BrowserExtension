import {
  handleHealthCheckMessage,
  isHealthCheckRequest,
  type HealthCheckResponse,
} from '@/src/messaging/health-check';
import {
  handleActionRequestMessage,
  isActionRequestMessage,
} from '@/src/messaging/action-messages';
import type { ActionListResponse } from '@/src/messaging/action-types';
import type { SessionResponse } from '@/src/messaging/session-types';
import {
  handleSessionRequestMessage,
  isSessionMutationRequest,
  isSessionRequestMessage,
  isSessionResponse,
} from '@/src/messaging/session-messages';
import type { SessionSnapshot } from '@/src/domain/session';
import type { SessionBackend } from '@/src/messaging/session-backend';
import type { ActionStore } from '@/src/actions/action-store';
import {
  handleConsoleIssueRequestMessage,
  isConsoleIssueRequestMessage,
} from '@/src/messaging/console-issue-messages';
import type { ConsoleIssueListResponse } from '@/src/messaging/console-issue-types';
import type { ConsoleIssueStore } from '@/src/console/console-issue-store';
import {
  handleNetworkIssueRequestMessage,
  isNetworkIssueRequestMessage,
} from '@/src/messaging/network-issue-messages';
import type { NetworkIssueListResponse } from '@/src/messaging/network-issue-types';
import type { NetworkIssueStore } from '@/src/network/network-issue-store';
import {
  handleUiIssueRequestMessage,
  isUiIssueRequestMessage,
} from '@/src/messaging/ui-issue-messages';
import type { UiIssueListResponse } from '@/src/messaging/ui-issue-types';
import type { UiIssueStore } from '@/src/ui/ui-issue-store';
import {
  handleUiRuleRequestMessage,
  isUiRuleRequestMessage,
} from '@/src/messaging/ui-rule-messages';
import type { UiRuleListResponse } from '@/src/messaging/ui-rule-types';
import type { UiRuleStore } from '@/src/ui/ui-rule-store';
import {
  handleIssueDispositionRequestMessage,
  isIssueDispositionRequestMessage,
  rejectInvalidIssueDispositionMessage,
} from '@/src/messaging/issue-disposition-messages';
import type { IssueDispositionMutationResponse } from '@/src/messaging/issue-disposition-types';
import {
  handleReportPageContextMessage,
  isReportPageContextMessage,
} from '@/src/messaging/page-context-messages';
import {
  handleReportCollectorReadiness,
  isGetCaptureReadinessMessage,
  isReportCollectorReadinessMessage,
} from '@/src/messaging/capture-readiness-messages';
import type { CaptureReadinessStore } from '@/src/sessions/capture-readiness-store';
import { REBROADCAST_SESSION_TO_TAB } from '@/src/messaging/capture-readiness-types';
import { isGetExtensionSettingsMessage } from '@/src/messaging/extension-settings-messages';
import type { ExtensionSettingsService } from '@/src/settings/extension-settings-service';
import {
  isDeleteScreenshotEvidenceMessage,
  isGetScreenshotEvidenceListMessage,
} from '@/src/messaging/screenshot-evidence-messages';
import type { ScreenshotCaptureService } from '@/src/screenshots/screenshot-capture-service';
import type { ScreenshotEvidenceStore } from '@/src/screenshots/screenshot-evidence-store';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import {
  handleIssueMarkRequestMessage,
  isIssueMarkRequestMessage,
} from '@/src/messaging/issue-mark-messages';
import type { IssueMarkResponse } from '@/src/messaging/issue-mark-types';
import type { IssueMarkStore } from '@/src/issue-marks/issue-mark-store';
import {
  handleBugReportContextRequestMessage,
  isBugReportContextRequestMessage,
} from '@/src/messaging/bug-report-context-messages';
import type { BugReportContextResponse } from '@/src/messaging/bug-report-context-types';
import type { BugReportContextStore } from '@/src/bug-report/bug-report-context-store';
import {
  handlePotentialBugRequestMessage,
  isPotentialBugRequestMessage,
  type PotentialBugHandlerDeps,
} from '@/src/messaging/potential-bug-messages';
import type { PotentialBugResponse } from '@/src/messaging/potential-bug-types';

export type BackgroundMessageResponse =
  | HealthCheckResponse
  | SessionResponse
  | ActionListResponse
  | ConsoleIssueListResponse
  | NetworkIssueListResponse
  | UiIssueListResponse
  | UiRuleListResponse
  | { ok: true; tabId: number | undefined }
  | {
      ok: true;
      readiness:
        | import('@/src/messaging/capture-readiness-types').CaptureReadinessSnapshot
        | null;
    }
  | { ok: true; rebroadcast: true }
  | {
      ok: true;
      settings: import('@/src/settings/extension-settings').ExtensionSettings;
    }
  | { ok: true; evidence: ScreenshotEvidence[] }
  | { ok: true; deleted: boolean }
  | IssueDispositionMutationResponse
  | IssueMarkResponse
  | BugReportContextResponse
  | PotentialBugResponse
  | undefined;

export type BackgroundRouterDeps = {
  readinessStore: CaptureReadinessStore;
  settingsService: ExtensionSettingsService;
  screenshotStore: ScreenshotEvidenceStore;
  screenshotCapture: ScreenshotCaptureService;
  getExpectedRecordingSession: () => {
    sessionId: string | undefined;
    revision: number;
  };
  getActiveSessionId: () => string | undefined;
  broadcastCaptureReadiness: () => void;
  broadcastScreenshotEvidence: () => void;
  rebroadcastSessionToTargetTab: () => void | Promise<void>;
  issueMarkStore: IssueMarkStore;
  sanitizePageUrl: (url: string) => string | null;
  broadcastIssueMark: () => void;
  getSessionSnapshot: () => import('@/src/domain/session').SessionSnapshot;
  bugReportContextStore: BugReportContextStore;
  broadcastBugReportContext: () => void;
  potentialBugs?: PotentialBugHandlerDeps;
};

export async function handleBackgroundMessage(
  message: unknown,
  backend: SessionBackend,
  actionStore: ActionStore,
  consoleIssueStore: ConsoleIssueStore,
  networkIssueStore: NetworkIssueStore,
  uiIssueStore: UiIssueStore,
  uiRuleStore: UiRuleStore,
  senderTabId: number | undefined,
  routerDeps?: BackgroundRouterDeps,
): Promise<BackgroundMessageResponse> {
  if (isHealthCheckRequest(message)) {
    return handleHealthCheckMessage();
  }

  if (
    routerDeps?.potentialBugs !== undefined &&
    isPotentialBugRequestMessage(message)
  ) {
    return handlePotentialBugRequestMessage(message, routerDeps.potentialBugs);
  }

  if (routerDeps !== undefined && isBugReportContextRequestMessage(message)) {
    return handleBugReportContextRequestMessage(message, {
      getSessionState: routerDeps.getSessionSnapshot,
      bugReportContextStore: routerDeps.bugReportContextStore,
      broadcastBugReportContext: routerDeps.broadcastBugReportContext,
    });
  }

  if (routerDeps !== undefined && isIssueMarkRequestMessage(message)) {
    return handleIssueMarkRequestMessage(message, {
      getSessionState: routerDeps.getSessionSnapshot,
      sanitizePageUrl: routerDeps.sanitizePageUrl,
      issueMarkStore: routerDeps.issueMarkStore,
      actionStore,
      consoleIssueStore,
      networkIssueStore,
      uiIssueStore,
      screenshotCapture: routerDeps.screenshotCapture,
      screenshotStore: routerDeps.screenshotStore,
      broadcastIssueMark: routerDeps.broadcastIssueMark,
    });
  }

  if (isReportPageContextMessage(message)) {
    const response = await handleReportPageContextMessage(
      message,
      backend,
      senderTabId,
    );
    return response;
  }

  if (routerDeps !== undefined && isReportCollectorReadinessMessage(message)) {
    const expected = routerDeps.getExpectedRecordingSession();
    const snapshot = handleReportCollectorReadiness(
      message,
      routerDeps.readinessStore,
      expected,
    );
    if (snapshot !== null) {
      routerDeps.broadcastCaptureReadiness();
    }
    return { ok: true, readiness: snapshot };
  }

  if (routerDeps !== undefined && isGetCaptureReadinessMessage(message)) {
    return {
      ok: true,
      readiness: routerDeps.readinessStore.getSnapshot(),
    };
  }

  if (routerDeps !== undefined && isGetExtensionSettingsMessage(message)) {
    return {
      ok: true,
      settings: routerDeps.settingsService.getSettings(),
    };
  }

  if (routerDeps !== undefined && isGetScreenshotEvidenceListMessage(message)) {
    const sessionId = routerDeps.getActiveSessionId();
    const evidence =
      sessionId === undefined
        ? []
        : routerDeps.screenshotStore.getRecordsForSession(sessionId);
    return { ok: true, evidence };
  }

  if (routerDeps !== undefined && isDeleteScreenshotEvidenceMessage(message)) {
    const deleted = await routerDeps.screenshotCapture.removeScreenshot(
      message.screenshotId,
    );
    return { ok: true, deleted };
  }

  if (
    routerDeps !== undefined &&
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === REBROADCAST_SESSION_TO_TAB
  ) {
    await routerDeps.rebroadcastSessionToTargetTab();
    return { ok: true, rebroadcast: true };
  }

  const invalidDispositionMessage =
    rejectInvalidIssueDispositionMessage(message);
  if (invalidDispositionMessage !== undefined) {
    return invalidDispositionMessage;
  }

  if (isIssueDispositionRequestMessage(message)) {
    const result = await handleIssueDispositionRequestMessage(message, {
      consoleIssueStore,
      networkIssueStore,
      uiIssueStore,
    });
    return result.response;
  }

  if (isConsoleIssueRequestMessage(message)) {
    return handleConsoleIssueRequestMessage(
      message,
      consoleIssueStore,
      senderTabId,
    );
  }

  if (isNetworkIssueRequestMessage(message)) {
    return handleNetworkIssueRequestMessage(
      message,
      networkIssueStore,
      senderTabId,
    );
  }

  if (isUiIssueRequestMessage(message)) {
    return handleUiIssueRequestMessage(message, uiIssueStore, senderTabId);
  }

  if (isUiRuleRequestMessage(message)) {
    return handleUiRuleRequestMessage(message, uiRuleStore);
  }

  if (isActionRequestMessage(message)) {
    return handleActionRequestMessage(message, actionStore, senderTabId);
  }

  if (!isSessionRequestMessage(message)) {
    return undefined;
  }

  return handleSessionRequestMessage(message, backend);
}

export function shouldBroadcastSessionUpdate(
  message: unknown,
  response: unknown,
): response is { ok: true; state: SessionSnapshot } {
  return (
    isSessionRequestMessage(message) &&
    isSessionMutationRequest(message) &&
    isSessionResponse(response) &&
    response.ok
  );
}
