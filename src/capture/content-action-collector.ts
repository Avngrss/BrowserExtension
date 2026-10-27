import type {
  ActionSubmissionPayload,
  SafeElementDescriptor,
} from '@/src/domain/action';
import { buildSafeElementDescriptor } from '@/src/capture/element-descriptor';
import {
  buildFieldActionPartial,
  type ChangeFieldPartial,
  type InputFieldPartial,
  isChangeInteractionField,
  isTextLikeField,
} from '@/src/capture/field-interaction';
import { InputDebounceTracker } from '@/src/capture/input-debounce-tracker';
import type { CollectorReadinessFlags } from '@/src/messaging/capture-readiness-types';
import type { CaptureCollectorSettings } from '@/src/settings/extension-settings';
import type { SessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';
import { sanitizeUrlForCapture } from '@/src/privacy/url-sanitize-runtime';
import { truncateCapturedText } from '@/src/privacy/text-sanitizer';

export type ActionSubmitHandler = (
  payload: ActionSubmissionPayload,
) => void | Promise<void>;

export type ContentCollectorOptions = {
  getLocation: () => Location;
  getDocumentTitle: () => string;
  submitAction: ActionSubmitHandler;
  isExtensionPage?: () => boolean;
};

export const HISTORY_MESSAGE_TYPE = 'BUG_CAPTURE_ASSISTANT_HISTORY';

type EmitPartial =
  | { type: 'navigation' }
  | { type: 'click'; element: SafeElementDescriptor }
  | { type: 'submit'; element: SafeElementDescriptor }
  | InputFieldPartial
  | ChangeFieldPartial;

export class ContentActionCollector {
  private session: SessionSnapshot = { status: 'idle' };
  private myTabId: number | undefined;
  private listenersActive = false;
  private initialNavigationSent = false;
  private readonly inputDebounce = new InputDebounceTracker();
  private onClick: ((event: MouseEvent) => void) | undefined;
  private onSubmit: ((event: SubmitEvent) => void) | undefined;
  private onInput: ((event: Event) => void) | undefined;
  private onChange: ((event: Event) => void) | undefined;
  private onBlur: ((event: FocusEvent) => void) | undefined;
  private onPopState: (() => void) | undefined;
  private onHashChange: (() => void) | undefined;
  private onHistoryMessage: ((event: MessageEvent) => void) | undefined;
  private captureActionsEnabled = true;

  constructor(private readonly options: ContentCollectorOptions) {}

  applyCaptureSettings(settings: CaptureCollectorSettings): void {
    this.captureActionsEnabled = settings.captureActions;
    this.syncListeners();
  }

  dispose(): void {
    this.inputDebounce.cancelAll();
    this.detachListeners();
  }

  setTabId(tabId: number | undefined): void {
    this.myTabId = tabId;
    this.syncListeners();
  }

  updateSession(snapshot: SessionSnapshot): void {
    const previousId = isActiveSession(this.session)
      ? this.session.id
      : undefined;
    this.session = snapshot;
    if (snapshot.status !== 'recording') {
      this.initialNavigationSent = false;
      this.inputDebounce.cancelAll();
    } else if (
      isActiveSession(snapshot) &&
      previousId !== undefined &&
      previousId !== snapshot.id
    ) {
      this.initialNavigationSent = false;
    }
    this.syncListeners();
  }

  resetForSessionChange(sessionId: string): void {
    void sessionId;
    this.initialNavigationSent = false;
    this.inputDebounce.cancelAll();
    this.syncListeners();
  }

  getCollectorReadiness(): CollectorReadinessFlags {
    if (!this.captureActionsEnabled) {
      return {
        actions: true,
        ui: true,
        console: true,
        network: true,
      };
    }
    const collecting = this.shouldCollect();
    return {
      actions: !collecting || this.listenersActive,
      ui: true,
      console: true,
      network: true,
    };
  }

  private shouldCollect(): boolean {
    if (!this.captureActionsEnabled) {
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

  private syncListeners(): void {
    const shouldCollect = this.shouldCollect();
    if (shouldCollect && !this.listenersActive) {
      this.attachListeners();
    }
    if (!shouldCollect && this.listenersActive) {
      this.inputDebounce.cancelAll();
      this.detachListeners();
    }
    if (shouldCollect && !this.initialNavigationSent) {
      this.initialNavigationSent = true;
      this.recordNavigation();
    }
  }

  private attachListeners(): void {
    if (this.listenersActive) {
      return;
    }

    this.onClick = (event) => {
      this.handleClick(event);
    };
    this.onSubmit = (event) => {
      this.handleSubmit(event);
    };
    this.onInput = (event) => {
      this.handleInput(event);
    };
    this.onChange = (event) => {
      this.handleChange(event);
    };
    this.onBlur = (event) => {
      this.handleBlur(event);
    };
    this.onPopState = () => {
      this.recordNavigation();
    };
    this.onHashChange = () => {
      this.recordNavigation();
    };
    this.onHistoryMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }
      if (
        !event.data ||
        typeof event.data !== 'object' ||
        (event.data as { type?: string }).type !== HISTORY_MESSAGE_TYPE
      ) {
        return;
      }
      this.recordNavigation();
    };

    document.addEventListener('click', this.onClick, true);
    document.addEventListener('submit', this.onSubmit, true);
    document.addEventListener('input', this.onInput, true);
    document.addEventListener('change', this.onChange, true);
    document.addEventListener('blur', this.onBlur, true);
    window.addEventListener('popstate', this.onPopState);
    window.addEventListener('hashchange', this.onHashChange);
    window.addEventListener('message', this.onHistoryMessage);
    this.listenersActive = true;
  }

  private detachListeners(): void {
    if (!this.listenersActive) {
      return;
    }

    if (this.onClick) {
      document.removeEventListener('click', this.onClick, true);
    }
    if (this.onSubmit) {
      document.removeEventListener('submit', this.onSubmit, true);
    }
    if (this.onInput) {
      document.removeEventListener('input', this.onInput, true);
    }
    if (this.onChange) {
      document.removeEventListener('change', this.onChange, true);
    }
    if (this.onBlur) {
      document.removeEventListener('blur', this.onBlur, true);
    }
    if (this.onPopState) {
      window.removeEventListener('popstate', this.onPopState);
    }
    if (this.onHashChange) {
      window.removeEventListener('hashchange', this.onHashChange);
    }
    if (this.onHistoryMessage) {
      window.removeEventListener('message', this.onHistoryMessage);
    }

    this.onClick = undefined;
    this.onSubmit = undefined;
    this.onInput = undefined;
    this.onChange = undefined;
    this.onBlur = undefined;
    this.onPopState = undefined;
    this.onHashChange = undefined;
    this.onHistoryMessage = undefined;
    this.listenersActive = false;
  }

  private resolveFieldElement(target: EventTarget | null): Element | null {
    if (!(target instanceof Element)) {
      return null;
    }
    return target;
  }

  private handleClick(event: MouseEvent): void {
    if (!this.shouldCollect() || this.isIgnoredEvent(event)) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const interactive = target.closest(
      'button,a,input[type="submit"],input[type="button"],[role="button"]',
    );
    if (interactive === null) {
      return;
    }

    this.emitAction({
      type: 'click',
      element: buildSafeElementDescriptor(interactive),
    });
  }

  private handleSubmit(event: SubmitEvent): void {
    if (!this.shouldCollect() || this.isIgnoredEvent(event)) {
      return;
    }

    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    this.emitAction({
      type: 'submit',
      element: buildSafeElementDescriptor(form),
    });
  }

  private handleInput(event: Event): void {
    if (!this.shouldCollect() || this.isIgnoredEvent(event)) {
      return;
    }

    const element = this.resolveFieldElement(event.target);
    if (element === null || !isTextLikeField(element)) {
      return;
    }

    this.inputDebounce.schedule(element, () => {
      if (!this.shouldCollect()) {
        return;
      }
      this.emitFieldAction(element, 'input');
    });
  }

  private handleBlur(event: FocusEvent): void {
    if (!this.shouldCollect() || this.isIgnoredEvent(event)) {
      return;
    }

    const element = this.resolveFieldElement(event.target);
    if (element === null || !isTextLikeField(element)) {
      return;
    }

    this.inputDebounce.flush(element, () => {
      if (!this.shouldCollect()) {
        return;
      }
      this.emitFieldAction(element, 'input');
    });
  }

  private handleChange(event: Event): void {
    if (!this.shouldCollect() || this.isIgnoredEvent(event)) {
      return;
    }

    const element = this.resolveFieldElement(event.target);
    if (element === null || !isChangeInteractionField(element)) {
      return;
    }

    if (isTextLikeField(element)) {
      return;
    }

    this.emitFieldAction(element, 'change');
  }

  private emitFieldAction(
    element: Element,
    actionType: 'input' | 'change',
  ): void {
    const partial = buildFieldActionPartial(element, actionType);
    if (partial === null) {
      return;
    }
    this.emitAction(partial);
  }

  private isIgnoredEvent(event: Event): boolean {
    if (this.options.isExtensionPage?.()) {
      return true;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return false;
    }

    return target.closest('[data-bug-capture-extension-root]') !== null;
  }

  private recordNavigation(): void {
    if (!this.shouldCollect()) {
      return;
    }
    this.emitAction({ type: 'navigation' });
  }

  private emitAction(partial: EmitPartial): void {
    if (!isActiveSession(this.session) || this.session.status !== 'recording') {
      return;
    }

    const url = sanitizeUrlForCapture(this.options.getLocation().href);
    if (url === null) {
      return;
    }

    const pageTitle = truncateCapturedText(this.options.getDocumentTitle());
    const payload = {
      ...partial,
      sessionId: this.session.id,
      timestamp: Date.now(),
      url,
      pageTitle,
    } satisfies ActionSubmissionPayload;

    void this.options.submitAction(payload);
  }
}

export function injectHistoryBridge(documentRef: Document): void {
  const script = documentRef.createElement('script');
  script.textContent = `
(() => {
  const messageType = ${JSON.stringify(HISTORY_MESSAGE_TYPE)};
  const notify = () => window.postMessage({ type: messageType }, '*');
  const wrap = (original) => function (...args) {
    const result = original.apply(this, args);
    notify();
    return result;
  };
  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
})();
`;
  documentRef.documentElement.appendChild(script);
  script.remove();
}
