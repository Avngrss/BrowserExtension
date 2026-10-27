import type {
  CaptureReadinessSnapshot,
  CollectorReadinessFlags,
} from '@/src/messaging/capture-readiness-types';

function collectorsReady(flags: CollectorReadinessFlags): boolean {
  return flags.actions && flags.ui && flags.console && flags.network;
}

export class CaptureReadinessStore {
  private snapshot: CaptureReadinessSnapshot | null = null;

  reset(): void {
    this.snapshot = null;
  }

  setReconnecting(
    sessionId: string,
    revision: number,
    tabId: number,
    reconnecting: boolean,
  ): void {
    const base: CaptureReadinessSnapshot = {
      sessionId,
      revision,
      tabId,
      collectors: {
        actions: false,
        ui: false,
        console: false,
        network: false,
      },
      reconnecting,
      updatedAt: Date.now(),
    };
    this.snapshot = base;
  }

  applyReport(input: {
    sessionId: string;
    revision: number;
    tabId: number;
    collectors: CollectorReadinessFlags;
    expectedSessionId: string | undefined;
    expectedRevision: number;
  }): CaptureReadinessSnapshot | null {
    if (
      input.expectedSessionId === undefined ||
      input.sessionId !== input.expectedSessionId ||
      input.revision !== input.expectedRevision
    ) {
      return null;
    }

    this.snapshot = {
      sessionId: input.sessionId,
      revision: input.revision,
      tabId: input.tabId,
      collectors: input.collectors,
      reconnecting: false,
      updatedAt: Date.now(),
    };
    return this.snapshot;
  }

  getSnapshot(): CaptureReadinessSnapshot | null {
    return this.snapshot;
  }

  isReadyForSession(sessionId: string, revision: number): boolean {
    if (this.snapshot === null) {
      return false;
    }
    if (
      this.snapshot.sessionId !== sessionId ||
      this.snapshot.revision !== revision
    ) {
      return false;
    }
    if (this.snapshot.reconnecting) {
      return false;
    }
    return collectorsReady(this.snapshot.collectors);
  }
}
