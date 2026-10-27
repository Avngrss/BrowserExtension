import type { UiIssueDetection } from '@/src/capture/ui-issue-detector';
import { UiIssueDetector } from '@/src/capture/ui-issue-detector';
import type { UiIssueSubmissionPayload } from '@/src/domain/ui-issue';
import type { UiIssueRule } from '@/src/domain/ui-rule';
import type { CollectorReadinessFlags } from '@/src/messaging/capture-readiness-types';
import type { CaptureCollectorSettings } from '@/src/settings/extension-settings';
import type { SessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';
import { isUiIssueListResponse } from '@/src/messaging/ui-issue-messages';
import { GET_UI_ISSUE_RULES } from '@/src/messaging/ui-rule-types';
import { sanitizeUrlForCapture } from '@/src/privacy/url-sanitize-runtime';
import { logDev } from '@/src/utils/dev-log';

export type UiIssueSubmitHandler = (
  payload: UiIssueSubmissionPayload,
) => void | Promise<unknown>;

export type ContentUiIssueCollectorOptions = {
  getLocation: () => Location;
  submitIssue: UiIssueSubmitHandler;
  sendRuntimeMessage: (message: unknown) => Promise<unknown>;
};

function isRuleListResponse(
  value: unknown,
): value is { ok: true; rules: UiIssueRule[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    value.ok === true &&
    'rules' in value &&
    Array.isArray((value as { rules: unknown }).rules)
  );
}

export class ContentUiIssueCollector {
  private session: SessionSnapshot = { status: 'idle' };
  private myTabId: number | undefined;
  private readonly detector: UiIssueDetector;
  private detectionSync: Promise<void> = Promise.resolve();
  private captureUiEnabled = true;

  constructor(private readonly options: ContentUiIssueCollectorOptions) {
    this.detector = new UiIssueDetector({
      root: document,
      onDetection: (detection) => {
        void this.handleDetection(detection);
      },
    });
  }

  setTabId(tabId: number | undefined): void {
    this.myTabId = tabId;
    this.queueDetectionSync();
  }

  updateSession(snapshot: SessionSnapshot): void {
    this.session = snapshot;
    this.queueDetectionSync();
  }

  resetForSessionChange(sessionId: string): void {
    void sessionId;
    this.detector.stop();
    this.queueDetectionSync();
  }

  applyCaptureSettings(settings: CaptureCollectorSettings): void {
    this.captureUiEnabled = settings.captureUiIssues;
    this.queueDetectionSync();
  }

  dispose(): void {
    this.detector.stop();
  }

  getCollectorReadiness(): CollectorReadinessFlags {
    if (!this.captureUiEnabled) {
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
      ui: !collecting || this.detector.isObserving(),
      console: true,
      network: true,
    };
  }

  applyRules(rules: readonly UiIssueRule[]): void {
    this.detector.setRules(rules);
    if (this.shouldCollect()) {
      this.detector.start();
    }
  }

  isObservingForTests(): boolean {
    return this.detector.isObserving();
  }

  private shouldCollect(): boolean {
    if (!this.captureUiEnabled) {
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

  private queueDetectionSync(): void {
    this.detectionSync = this.detectionSync.then(() => this.syncDetection());
  }

  private async syncDetection(): Promise<void> {
    if (!this.shouldCollect()) {
      this.detector.stop();
      return;
    }

    const rules = await this.loadRules();
    this.detector.setRules(rules);
    this.detector.start();
  }

  private async loadRules(): Promise<UiIssueRule[]> {
    try {
      const response: unknown = await this.options.sendRuntimeMessage({
        type: GET_UI_ISSUE_RULES,
      });
      if (!isRuleListResponse(response)) {
        return [];
      }
      return response.rules;
    } catch {
      return [];
    }
  }

  private async handleDetection(detection: UiIssueDetection): Promise<void> {
    if (!this.shouldCollect()) {
      return;
    }

    const url = sanitizeUrlForCapture(this.options.getLocation().href);
    if (url === null || !isActiveSession(this.session)) {
      return;
    }

    const payload: UiIssueSubmissionPayload = {
      sessionId: this.session.id,
      timestamp: Date.now(),
      ruleId: detection.rule.id,
      ruleName: detection.rule.name,
      severity: detection.rule.severity,
      url,
      element: detection.element,
      ...(detection.visibleMessage !== undefined
        ? { visibleMessage: detection.visibleMessage }
        : {}),
    };

    logDev('Bug Capture Assistant forwarded a UI issue to background.');
    const result = await this.options.submitIssue(payload);
    if (
      import.meta.env.DEV &&
      result !== undefined &&
      isUiIssueListResponse(result) &&
      !result.ok
    ) {
      logDev(`Bug Capture Assistant UI issue rejected: ${result.error.code}`);
    }
  }
}
