import {
  MAX_CONSOLE_MESSAGE_LENGTH,
  MAX_CONSOLE_STACK_LENGTH,
  normalizeConsoleArguments,
} from '@/src/console/normalize-console-args';
import { sanitizeIssueText } from '@/src/console/sanitize-issue-text';
import {
  postConsoleBridgeActivate,
  postConsoleBridgeRequestReady,
} from '@/src/capture/console-bridge-control';
import {
  parseConsoleBridgeIssueMessage,
  parseConsoleBridgeReadyMessage,
} from '@/src/capture/console-bridge-validation';
import type { ConsoleIssueSubmissionPayload } from '@/src/domain/console-issue';
import type { CollectorReadinessFlags } from '@/src/messaging/capture-readiness-types';
import type { CaptureCollectorSettings } from '@/src/settings/extension-settings';
import type { SessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';
import { sanitizeUrlForCapture } from '@/src/privacy/url-sanitize-runtime';
import { logDev } from '@/src/utils/dev-log';
import { isConsoleIssueListResponse } from '@/src/messaging/console-issue-messages';

export type ConsoleIssueSubmitHandler = (
  payload: ConsoleIssueSubmissionPayload,
) => void | Promise<unknown>;

export type ContentConsoleCollectorOptions = {
  getLocation: () => Location;
  submitIssue: ConsoleIssueSubmitHandler;
};

export class ContentConsoleCollector {
  private session: SessionSnapshot = { status: 'idle' };
  private myTabId: number | undefined;
  private bridgeReady = false;
  private bridgeListenerAttached = false;
  private captureConsoleEnabled = true;
  private readonly onBridgeMessage: (event: MessageEvent) => void;

  constructor(private readonly options: ContentConsoleCollectorOptions) {
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
    this.captureConsoleEnabled = settings.captureConsoleErrors;
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
    if (!this.captureConsoleEnabled) {
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
      console: !collecting || this.bridgeReady,
      network: true,
    };
  }

  private shouldCollect(): boolean {
    if (!this.captureConsoleEnabled) {
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
      logDev('Bug Capture Assistant isolated console bridge ready.');
      this.syncBridgeActivation();
      return;
    }

    const issue = parseConsoleBridgeIssueMessage(data);
    if (issue === null) {
      return;
    }

    void this.handleBridgeIssue(issue);
  }

  private async handleBridgeIssue(
    event: NonNullable<ReturnType<typeof parseConsoleBridgeIssueMessage>>,
  ): Promise<void> {
    if (!this.shouldCollect()) {
      return;
    }

    const url = sanitizeUrlForCapture(this.options.getLocation().href);
    if (url === null || !isActiveSession(this.session)) {
      return;
    }

    const rawMessage =
      event.category === 'console-error'
        ? normalizeConsoleArguments(event.parts)
        : (event.message ?? 'Unknown error');

    const sanitizedMessage = sanitizeIssueText(
      rawMessage,
      MAX_CONSOLE_MESSAGE_LENGTH,
    );
    const message =
      sanitizedMessage.length > 0 ? sanitizedMessage : 'Unknown error';
    const stack =
      event.stack !== undefined
        ? sanitizeIssueText(event.stack, MAX_CONSOLE_STACK_LENGTH)
        : undefined;

    const payload: ConsoleIssueSubmissionPayload = {
      sessionId: this.session.id,
      timestamp: Date.now(),
      category: event.category,
      message,
      url,
      ...(stack !== undefined ? { stack } : {}),
    };

    logDev('Bug Capture Assistant forwarded a console issue to background.');
    const result = await this.options.submitIssue(payload);
    if (
      import.meta.env.DEV &&
      result !== undefined &&
      isConsoleIssueListResponse(result) &&
      !result.ok
    ) {
      logDev(
        `Bug Capture Assistant console issue rejected: ${result.error.code}`,
      );
    }
  }
}
