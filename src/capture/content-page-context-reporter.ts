import { HISTORY_MESSAGE_TYPE } from '@/src/capture/content-action-collector';

export type PageContextSubmitHandler = (input: {
  url: string;
  pageTitle: string;
  updatedAt: number;
}) => void;

export class ContentPageContextReporter {
  private started = false;
  private titleObserver: MutationObserver | undefined;
  private onPopState: (() => void) | undefined;
  private onHashChange: (() => void) | undefined;
  private onPageShow: (() => void) | undefined;
  private onHistoryMessage: ((event: MessageEvent) => void) | undefined;

  constructor(
    private readonly options: {
      getLocation: () => Location;
      getDocumentTitle: () => string;
      submit: PageContextSubmitHandler;
    },
  ) {}

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    const report = (): void => {
      this.options.submit({
        url: this.options.getLocation().href,
        pageTitle: this.options.getDocumentTitle(),
        updatedAt: Date.now(),
      });
    };

    this.onPopState = report;
    this.onHashChange = report;
    this.onPageShow = report;
    this.onHistoryMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }
      if (
        typeof event.data === 'object' &&
        event.data !== null &&
        'type' in event.data &&
        (event.data as { type: unknown }).type === HISTORY_MESSAGE_TYPE
      ) {
        report();
      }
    };

    window.addEventListener('popstate', this.onPopState);
    window.addEventListener('hashchange', this.onHashChange);
    window.addEventListener('pageshow', this.onPageShow);
    window.addEventListener('message', this.onHistoryMessage);

    const titleElement = document.querySelector('title');
    if (titleElement !== null) {
      this.titleObserver = new MutationObserver(() => {
        report();
      });
      this.titleObserver.observe(titleElement, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    report();
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;

    if (this.onPopState) {
      window.removeEventListener('popstate', this.onPopState);
    }
    if (this.onHashChange) {
      window.removeEventListener('hashchange', this.onHashChange);
    }
    if (this.onPageShow) {
      window.removeEventListener('pageshow', this.onPageShow);
    }
    if (this.onHistoryMessage) {
      window.removeEventListener('message', this.onHistoryMessage);
    }
    this.titleObserver?.disconnect();
    this.titleObserver = undefined;
    this.onPopState = undefined;
    this.onHashChange = undefined;
    this.onPageShow = undefined;
    this.onHistoryMessage = undefined;
  }
}
