import {
  ContentActionCollector,
  injectHistoryBridge,
} from '@/src/capture/content-action-collector';
import { ContentConsoleCollector } from '@/src/capture/content-console-collector';
import { ContentNetworkCollector } from '@/src/capture/content-network-collector';
import { ContentUiIssueCollector } from '@/src/capture/content-ui-issue-collector';
import { ContentPageContextReporter } from '@/src/capture/content-page-context-reporter';
import { ContentReadinessReporter } from '@/src/capture/content-readiness-reporter';
import { ContentSessionSync } from '@/src/capture/content-session-sync';
import { ExtensionContextGuard } from '@/src/capture/extension-context-guard';
import {
  markContentScriptRegistryDisposed,
  readContentScriptRegistry,
  registerContentScriptInstance,
} from '@/src/capture/content-script-registry';
import {
  CONTENT_BOOTSTRAP_PONG,
  getOrCreateDocumentId,
  isContentBootstrapPingMessage,
  isCompatibleBootstrapPong,
  type ContentBootstrapPongMessage,
} from '@/src/messaging/content-bootstrap-types';
import {
  isExtensionSettingsUpdatedMessage,
  GET_EXTENSION_SETTINGS,
} from '@/src/messaging/extension-settings-messages';
import {
  HEALTH_CHECK_TYPE,
  type HealthCheckRequest,
} from '@/src/messaging/health-check';
import { isSessionStateUpdatedMessage } from '@/src/messaging/session-messages';
import { isSessionSnapshot } from '@/src/sessions/session-snapshot-validation';
import {
  GET_CONTENT_TAB_ID,
  SUBMIT_ACTION,
} from '@/src/messaging/action-types';
import { SUBMIT_CONSOLE_ISSUE } from '@/src/messaging/console-issue-types';
import { SUBMIT_NETWORK_ISSUE } from '@/src/messaging/network-issue-types';
import { SUBMIT_UI_ISSUE } from '@/src/messaging/ui-issue-types';
import { isUiRulesUpdatedMessage } from '@/src/messaging/ui-rule-messages';
import { GET_SESSION_STATE } from '@/src/messaging/session-types';
import { REPORT_PAGE_CONTEXT } from '@/src/messaging/page-context-types';
import {
  parseExtensionSettings,
  type ExtensionSettings,
} from '@/src/settings/extension-settings';
import { applyUrlSanitizeSettings } from '@/src/privacy/url-sanitize-runtime';
import {
  readExtensionBuildVersion,
  readExtensionRuntimeId,
} from '@/src/utils/extension-build';
import { logDev } from '@/src/utils/dev-log';
import { browser } from 'wxt/browser';

function isSessionSuccessResponse(
  value: unknown,
): value is { ok: true; state: unknown; revision: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    value.ok === true &&
    'state' in value &&
    'revision' in value &&
    typeof (value as { revision: unknown }).revision === 'number'
  );
}

function isSettingsResponse(
  value: unknown,
): value is { ok: true; settings: ExtensionSettings } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    value.ok === true &&
    'settings' in value
  );
}

function createBootstrapPong(input: {
  buildVersion: string;
  runtimeId: string;
  contentInstanceId: string;
}): ContentBootstrapPongMessage {
  return {
    type: CONTENT_BOOTSTRAP_PONG,
    protocolVersion: 1,
    buildVersion: input.buildVersion,
    runtimeId: input.runtimeId,
    contentInstanceId: input.contentInstanceId,
    documentId: getOrCreateDocumentId(),
  };
}

function attachBootstrapPingListener(input: {
  buildVersion: string;
  runtimeId: string;
  contentInstanceId: string;
}): void {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isContentBootstrapPingMessage(message)) {
      return undefined;
    }
    const pong = createBootstrapPong(input);
    if (
      isCompatibleBootstrapPong(pong, {
        buildVersion: message.buildVersion,
        runtimeId: message.runtimeId,
      })
    ) {
      sendResponse(pong);
      readContentScriptRegistry()?.resyncFromBackground?.();
      return true;
    }
    return undefined;
  });
}

export function runContentScript(): void {
  const buildVersion = readExtensionBuildVersion();
  const runtimeId = readExtensionRuntimeId();
  const existing = readContentScriptRegistry();

  if (
    existing !== undefined &&
    !existing.disposed &&
    existing.buildVersion === buildVersion &&
    existing.runtimeId === runtimeId
  ) {
    attachBootstrapPingListener({
      buildVersion,
      runtimeId,
      contentInstanceId: existing.contentInstanceId,
    });
    existing.resyncFromBackground?.();
    return;
  }

  if (existing !== undefined && !existing.disposed) {
    existing.dispose();
  }

  if (!runtimeId) {
    return;
  }

  const guard = new ExtensionContextGuard();
  const contentInstanceId = crypto.randomUUID();

  logDev('Bug Capture Assistant content script started.');

  injectHistoryBridge(document);

  let extensionSettings: ExtensionSettings = parseExtensionSettings(undefined);

  const safeSend = (message: Record<string, unknown>): Promise<unknown> =>
    guard.sendRuntimeMessage(message);

  const collector = new ContentActionCollector({
    getLocation: () => window.location,
    getDocumentTitle: () => document.title,
    submitAction: async (action) => {
      if (!guard.assertUsable()) {
        return;
      }
      await safeSend({
        type: SUBMIT_ACTION,
        action,
      }).catch(() => undefined);
    },
    isExtensionPage: () => window.location.protocol === 'chrome-extension:',
  });

  const consoleCollector = new ContentConsoleCollector({
    getLocation: () => window.location,
    submitIssue: (issue) => {
      if (!guard.assertUsable()) {
        return Promise.resolve();
      }
      return safeSend({
        type: SUBMIT_CONSOLE_ISSUE,
        issue,
      }).catch(() => undefined);
    },
  });

  const networkCollector = new ContentNetworkCollector({
    getLocation: () => window.location,
    submitIssue: (issue) => {
      if (!guard.assertUsable()) {
        return Promise.resolve();
      }
      return safeSend({
        type: SUBMIT_NETWORK_ISSUE,
        issue,
      }).catch(() => undefined);
    },
  });

  const uiIssueCollector = new ContentUiIssueCollector({
    getLocation: () => window.location,
    submitIssue: (issue) => {
      if (!guard.assertUsable()) {
        return Promise.resolve();
      }
      return safeSend({
        type: SUBMIT_UI_ISSUE,
        issue,
      }).catch(() => undefined);
    },
    sendRuntimeMessage: (message) =>
      safeSend(message as Record<string, unknown>),
  });

  const readinessReporter = new ContentReadinessReporter(
    [collector, uiIssueCollector, consoleCollector, networkCollector],
    (message) => safeSend(message),
  );

  const sessionSync = new ContentSessionSync(
    [collector, uiIssueCollector, consoleCollector, networkCollector],
    (state, revision) => {
      readinessReporter.applySession(state, revision);
    },
  );

  const pageContextReporter = new ContentPageContextReporter({
    getLocation: () => window.location,
    getDocumentTitle: () => document.title,
    submit: (payload) => {
      if (!guard.assertUsable()) {
        return;
      }
      void safeSend({
        type: REPORT_PAGE_CONTEXT,
        url: payload.url,
        pageTitle: payload.pageTitle,
        updatedAt: payload.updatedAt,
      }).catch(() => undefined);
    },
  });
  pageContextReporter.start();

  function applySettings(settings: ExtensionSettings): void {
    extensionSettings = settings;
    applyUrlSanitizeSettings(settings.privacy);
    collector.applyCaptureSettings(settings.capture);
    uiIssueCollector.applyCaptureSettings(settings.capture);
    consoleCollector.applyCaptureSettings(settings.capture);
    networkCollector.applyCaptureSettings(settings.capture);
    readinessReporter.report();
  }

  applySettings(extensionSettings);

  const runtimeListener = (message: unknown): void => {
    if (!guard.assertUsable()) {
      return;
    }
    if (isSessionStateUpdatedMessage(message)) {
      sessionSync.applySessionState(message.state, message.revision);
    }
    if (isUiRulesUpdatedMessage(message)) {
      uiIssueCollector.applyRules(message.rules);
    }
    if (isExtensionSettingsUpdatedMessage(message)) {
      applySettings(message.settings);
    }
  };

  browser.runtime.onMessage.addListener(runtimeListener);
  attachBootstrapPingListener({ buildVersion, runtimeId, contentInstanceId });

  guard.registerDispose(() => {
    markContentScriptRegistryDisposed();
    readinessReporter.dispose();
    pageContextReporter.stop();
    collector.dispose();
    uiIssueCollector.dispose();
    consoleCollector.dispose();
    networkCollector.dispose();
    browser.runtime.onMessage.removeListener(runtimeListener);
  });

  const resyncFromBackground = (): void => {
    if (!guard.assertUsable()) {
      return;
    }
    void safeSend({ type: GET_SESSION_STATE })
      .then((response: unknown) => {
        if (!isSessionSuccessResponse(response)) {
          return;
        }
        if (isSessionSnapshot(response.state)) {
          sessionSync.applySessionState(response.state, response.revision);
        }
      })
      .catch(() => undefined);
    readinessReporter.report();
  };

  registerContentScriptInstance({
    buildVersion,
    runtimeId,
    contentInstanceId,
    guard,
    disposed: false,
    dispose: () => {
      guard.dispose('registry-dispose');
    },
    resyncFromBackground,
  });

  void safeSend({ type: GET_EXTENSION_SETTINGS })
    .then((response: unknown) => {
      if (isSettingsResponse(response)) {
        applySettings(response.settings);
      }
    })
    .catch(() => undefined);

  void safeSend({ type: GET_CONTENT_TAB_ID })
    .then((response: unknown) => {
      if (
        response &&
        typeof response === 'object' &&
        'ok' in response &&
        response.ok === true &&
        'tabId' in response
      ) {
        const tabId = (response as { tabId?: number }).tabId;
        sessionSync.setTabId(tabId);
        readinessReporter.setTabId(tabId);
      }
    })
    .catch(() => undefined);

  void safeSend({ type: GET_SESSION_STATE })
    .then((response: unknown) => {
      if (!isSessionSuccessResponse(response)) {
        return;
      }
      if (isSessionSnapshot(response.state)) {
        sessionSync.applySessionState(response.state, response.revision);
      }
    })
    .catch(() => undefined);

  const request = {
    type: HEALTH_CHECK_TYPE,
  } satisfies HealthCheckRequest;
  void safeSend(request).catch(() => undefined);
}
