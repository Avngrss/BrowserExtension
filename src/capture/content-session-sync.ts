import type { SessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';
import type { ReadinessCapableCollector } from '@/src/capture/collector-readiness';

function snapshotsEqual(
  left: SessionSnapshot,
  right: SessionSnapshot,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class ContentSessionSync {
  private appliedRevision = -1;
  private lastState: SessionSnapshot = { status: 'idle' };

  constructor(
    private readonly collectors: ReadinessCapableCollector[],
    private readonly onStateApplied?: (
      state: SessionSnapshot,
      revision: number,
    ) => void,
  ) {}

  setTabId(tabId: number | undefined): void {
    for (const collector of this.collectors) {
      if ('setTabId' in collector) {
        (collector as { setTabId: (id: number | undefined) => void }).setTabId(
          tabId,
        );
      }
    }
    this.onStateApplied?.(this.lastState, this.appliedRevision);
  }

  applySessionState(state: SessionSnapshot, revision: number): void {
    if (revision < this.appliedRevision) {
      return;
    }

    if (
      revision === this.appliedRevision &&
      snapshotsEqual(state, this.lastState)
    ) {
      return;
    }

    const previousId = isActiveSession(this.lastState)
      ? this.lastState.id
      : undefined;
    const nextId = isActiveSession(state) ? state.id : undefined;

    if (nextId !== undefined && previousId !== nextId) {
      for (const collector of this.collectors) {
        collector.resetForSessionChange(nextId);
      }
    }

    this.appliedRevision = revision;
    this.lastState = state;
    for (const collector of this.collectors) {
      if ('updateSession' in collector) {
        (
          collector as { updateSession: (snapshot: SessionSnapshot) => void }
        ).updateSession(state);
      }
    }
    this.onStateApplied?.(state, revision);
  }

  getAppliedRevision(): number {
    return this.appliedRevision;
  }
}
