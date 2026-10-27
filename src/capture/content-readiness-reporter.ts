import type { SessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';
import type { CollectorReadinessFlags } from '@/src/messaging/capture-readiness-types';
import { REPORT_COLLECTOR_READINESS } from '@/src/messaging/capture-readiness-types';
import { mergeCollectorReadiness } from '@/src/capture/collector-readiness';
import type { ReadinessCapableCollector } from '@/src/capture/collector-readiness';

export class ContentReadinessReporter {
  private tabId: number | undefined;
  private session: SessionSnapshot = { status: 'idle' };
  private revision = -1;
  private pollHandle: number | undefined;
  private stopped = false;

  constructor(
    private readonly collectors: ReadinessCapableCollector[],
    private readonly sendRuntimeMessage: (
      message: Record<string, unknown>,
    ) => Promise<unknown>,
  ) {}

  dispose(): void {
    this.stopped = true;
    if (this.pollHandle !== undefined) {
      window.clearInterval(this.pollHandle);
      this.pollHandle = undefined;
    }
  }

  setTabId(tabId: number | undefined): void {
    this.tabId = tabId;
    this.report();
  }

  applySession(state: SessionSnapshot, revision: number): void {
    this.session = state;
    this.revision = revision;
    if (this.pollHandle !== undefined) {
      window.clearInterval(this.pollHandle);
      this.pollHandle = undefined;
    }
    if (isActiveSession(state) && state.status === 'recording') {
      this.report();
      this.pollHandle = window.setInterval(() => {
        this.report();
      }, 400);
    }
  }

  report(): void {
    if (
      this.stopped ||
      this.tabId === undefined ||
      !isActiveSession(this.session) ||
      this.session.status !== 'recording'
    ) {
      return;
    }

    const flags = mergeCollectorReadiness(
      this.collectors.map((collector) => collector.getCollectorReadiness()),
    );

    void this.sendRuntimeMessage({
      type: REPORT_COLLECTOR_READINESS,
      sessionId: this.session.id,
      revision: this.revision,
      tabId: this.tabId,
      collectors: flags,
    }).catch(() => undefined);
  }
}

export function emptyReadinessFlags(): CollectorReadinessFlags {
  return {
    actions: false,
    ui: false,
    console: false,
    network: false,
  };
}
