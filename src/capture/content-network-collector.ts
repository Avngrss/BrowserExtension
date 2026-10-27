import {
  postConsoleBridgeActivate,
  postConsoleBridgeRequestReady,
} from '@/src/capture/console-bridge-control';
import { parseConsoleBridgeReadyMessage } from '@/src/capture/console-bridge-validation';
import { parseNetworkBridgeIssueMessage } from '@/src/capture/network-bridge-validation';
import type { NetworkIssueSubmissionPayload } from '@/src/domain/network-issue';
import type { CollectorReadinessFlags } from '@/src/messaging/capture-readiness-types';
import type { CaptureCollectorSettings } from '@/src/settings/extension-settings';
import type { SessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';
import { isNetworkIssueListResponse } from '@/src/messaging/network-issue-messages';
import { sanitizeUrlForCapture } from '@/src/privacy/url-sanitize-runtime';
import { logDev } from '@/src/utils/dev-log';

export type NetworkIssueSubmitHandler = (
  payload: NetworkIssueSubmissionPayload,
) => void | Promise<unknown>;

export type ContentNetworkCollectorOptions = {
  getLocation: () => Location;
  submitIssue: NetworkIssueSubmitHandler;
};

export class ContentNetworkCollector {
  private session: SessionSnapshot = { status: 'idle' };
  private myTabId: number | undefined;
  private bridgeReady = false;
  private bridgeListenerAttached = false;
  private captureNetworkEnabled = true;
  private readonly onBridgeMessage: (event: MessageEvent) => void;

  constructor(private readonly options: ContentNetworkCollectorOptions) {
    this.onBridgeMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }
      this.handleWindowMessage(event.data);
    };
    this.attachBridgeListener();
    postConsoleBridgeRequestReady();
  }

  setTabId(tabId: number | undefined): void {
    this.myTabId = tabId;
    this.syncBridgeActivation();
  }

  updateSession(snapshot: SessionSnapshot): void {
    this.session = snapshot;
    this.syncBridgeActivation();
  }

  resetForSessionChange(sessionId: string): void {
    void sessionId;
    this.bridgeReady = false;
    postConsoleBridgeRequestReady();
  }

  applyCaptureSettings(settings: CaptureCollectorSettings): void {
    this.captureNetworkEnabled = settings.captureNetworkFailures;
    this.syncBridgeActivation();
  }

  dispose(): void {
    if (this.bridgeListenerAttached) {
      window.removeEventListener('message', this.onBridgeMessage);
      this.bridgeListenerAttached = false;
    }
    postConsoleBridgeActivate(false);
  }

  getCollectorReadiness(): CollectorReadinessFlags {
    if (!this.captureNetworkEnabled) {
      return {
        actions: true,
        ui: true,
        console: true,
        network: true,
      };
    }
    const collecting = this.shouldCollect();
    return {
      actions: true,
      ui: true,
      console: true,
      network: !collecting || this.bridgeReady,
    };
  }

  private shouldCollect(): boolean {
    if (!this.captureNetworkEnabled) {
      return false;
    }
    if (!isActiveSession(this.session) || this.session.status !== 'recording') {
      return false;
    }
    if (this.myTabId === undefined) {
      return false;
    }
    return this.session.targetTabId === this.myTabId;
  }

  private attachBridgeListener(): void {
    if (this.bridgeListenerAttached) {
      return;
    }
    window.addEventListener('message', this.onBridgeMessage);
    this.bridgeListenerAttached = true;
  }

  private syncBridgeActivation(): void {
    if (!this.bridgeReady) {
      postConsoleBridgeRequestReady();
      return;
    }
    postConsoleBridgeActivate(this.shouldCollect());
  }

  private handleWindowMessage(data: unknown): void {
    if (parseConsoleBridgeReadyMessage(data) !== null) {
      this.bridgeReady = true;
      logDev('Bug Capture Assistant isolated network bridge ready.');
      this.syncBridgeActivation();
      return;
    }

    const event = parseNetworkBridgeIssueMessage(data);
    if (event === null) {
      return;
    }

    void this.handleBridgeIssue(event);
  }

  private async handleBridgeIssue(
    event: NonNullable<ReturnType<typeof parseNetworkBridgeIssueMessage>>,
  ): Promise<void> {
    if (!this.shouldCollect()) {
      return;
    }

    const pageUrl = sanitizeUrlForCapture(this.options.getLocation().href);
    if (pageUrl === null || !isActiveSession(this.session)) {
      return;
    }

    const requestUrl = sanitizeUrlForCapture(event.requestUrl);
    if (requestUrl === null) {
      return;
    }

    const method = event.method.toUpperCase();
    const payload: NetworkIssueSubmissionPayload = {
      sessionId: this.session.id,
      timestamp: Date.now(),
      source: event.source,
      category: event.category,
      method,
      url: requestUrl,
      ...(event.status !== undefined ? { status: event.status } : {}),
      ...(event.statusText !== undefined
        ? { statusText: event.statusText }
        : {}),
      ...(event.durationMs !== undefined
        ? { durationMs: event.durationMs }
        : {}),
      ...(event.failureMessage !== undefined
        ? { failureMessage: event.failureMessage }
        : {}),
    };

    logDev('Bug Capture Assistant forwarded a network issue to background.');
    const result = await this.options.submitIssue(payload);
    if (
      import.meta.env.DEV &&
      result !== undefined &&
      isNetworkIssueListResponse(result) &&
      !result.ok
    ) {
      logDev(
        `Bug Capture Assistant network issue rejected: ${result.error.code}`,
      );
    }
  }
}
