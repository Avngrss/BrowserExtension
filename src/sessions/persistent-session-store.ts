import {
  createIdleSessionSnapshot,
  isActiveSession,
  type SessionCommand,
  type SessionSnapshot,
} from '@/src/domain/session';
import { buildPageContextUpdate } from '@/src/sessions/page-context';
import type { SessionBackend } from '@/src/messaging/session-backend';
import {
  SESSION_CLEAR_FAILED_MESSAGE,
  SESSION_PERSISTENCE_FAILED_MESSAGE,
  SESSION_SYNC_FAILED_MESSAGE,
} from '@/src/messaging/session-feedback';
import type { SessionResponse } from '@/src/messaging/session-types';
import { applySessionCommand } from '@/src/sessions/lifecycle';
import type { InMemorySessionStore } from '@/src/sessions/in-memory-session-store';
import { parseSessionSnapshot } from '@/src/sessions/session-snapshot-validation';
import { SessionRevisionTracker } from '@/src/sessions/session-revision';
import type { SessionStorageAdapter } from '@/src/sessions/session-storage';
import type { SessionTabResolver } from '@/src/sessions/session-tab-resolver';
import { logCaptureBootstrapDiagnostics } from '@/src/capture/capture-start-diagnostics';
import { NO_SUPPORTED_TARGET_TAB_MESSAGE } from '@/src/sessions/session-tab-resolver';

export type { SessionBackend };

export type TargetTabBootstrapResult =
  | { ok: true }
  | {
      ok: false;
      code: 'CONTENT_BOOTSTRAP_FAILED' | 'UNSUPPORTED_TARGET_TAB';
      message: string;
    };

export type PersistentSessionStoreOptions = {
  tabResolver: SessionTabResolver;
  onSessionStarted?: (nextState: SessionSnapshot) => Promise<void>;
  onSessionStopped?: (state: SessionSnapshot) => Promise<void>;
  /** After delete resets to idle, sync the former target tab (idle is not broadcast via target binding). */
  onSessionDeletedOnTab?: (input: {
    tabId: number;
    state: SessionSnapshot;
    revision: number;
  }) => Promise<void>;
  clearSessionArtifacts?: (sessionId: string | null) => Promise<void>;
  ensureTargetTabReady?: (tabId: number) => Promise<TargetTabBootstrapResult>;
  revisionTracker?: SessionRevisionTracker;
};

export function createInMemorySessionBackend(
  store: InMemorySessionStore,
  revisionTracker: SessionRevisionTracker = new SessionRevisionTracker(),
): SessionBackend {
  revisionTracker.commit();

  return {
    getSessionState: () =>
      Promise.resolve({
        ok: true,
        state: store.getState(),
        revision: revisionTracker.getRevision(),
      }),
    runSessionCommand: (command) => {
      const response = store.execute(command);
      if (!response.ok) {
        return Promise.resolve(response);
      }
      revisionTracker.commit();
      return Promise.resolve({
        ok: true,
        state: response.state,
        revision: revisionTracker.getRevision(),
      });
    },
    startNewCapture: () => {
      const response = store.execute('start');
      if (!response.ok) {
        return Promise.resolve(response);
      }
      revisionTracker.commit();
      return Promise.resolve({
        ok: true,
        state: response.state,
        revision: revisionTracker.getRevision(),
      });
    },
    deleteSession: () => {
      const response = store.execute('reset');
      if (!response.ok) {
        return Promise.resolve(response);
      }
      revisionTracker.commit();
      return Promise.resolve({
        ok: true,
        state: response.state,
        revision: revisionTracker.getRevision(),
      });
    },
  };
}

export class PersistentSessionStore implements SessionBackend {
  private readonly ready: Promise<void>;
  private restorationError: string | undefined;
  private lastPersisted: SessionSnapshot = createIdleSessionSnapshot();
  private readonly revisionTracker: SessionRevisionTracker;
  private persistChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly memory: InMemorySessionStore,
    private readonly storage: SessionStorageAdapter,
    private readonly options: PersistentSessionStoreOptions,
  ) {
    this.revisionTracker =
      options.revisionTracker ?? new SessionRevisionTracker();
    this.ready = this.restoreFromStorage();
  }

  waitUntilReady(): Promise<void> {
    return this.ready;
  }

  waitUntilPersistIdle(): Promise<void> {
    return this.persistChain;
  }

  getLastPersistedState(): SessionSnapshot {
    return this.lastPersisted;
  }

  getRevision(): number {
    return this.revisionTracker.getRevision();
  }

  private commitRestoredState(): void {
    this.revisionTracker.commit();
  }

  private async restoreFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.read();
      if (stored === undefined || stored === null) {
        this.lastPersisted = createIdleSessionSnapshot();
        this.commitRestoredState();
        return;
      }

      const parsed = parseSessionSnapshot(stored);
      if (parsed === null) {
        await this.storage.remove();
        this.memory.replaceState(createIdleSessionSnapshot());
        this.lastPersisted = createIdleSessionSnapshot();
        this.commitRestoredState();
        return;
      }

      this.memory.replaceState(parsed);
      this.lastPersisted = parsed;
      this.commitRestoredState();
    } catch {
      this.restorationError = SESSION_SYNC_FAILED_MESSAGE;
      this.memory.replaceState(createIdleSessionSnapshot());
      this.lastPersisted = createIdleSessionSnapshot();
      this.commitRestoredState();
    }
  }

  async getSessionState(): Promise<SessionResponse> {
    await this.ready;
    if (this.restorationError !== undefined) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_ERROR',
          message: this.restorationError,
        },
      };
    }

    return {
      ok: true,
      state: this.memory.getState(),
      revision: this.revisionTracker.getRevision(),
    };
  }

  async updatePageContext(
    input: { url: string; pageTitle?: string; updatedAt: number },
    senderTabId: number | undefined,
  ): Promise<SessionResponse> {
    await this.ready;
    const current = this.memory.getState();
    if (!isActiveSession(current)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: 'Page context updates require an active session.',
        },
      };
    }

    if (senderTabId === undefined || senderTabId !== current.targetTabId) {
      return {
        ok: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: 'Page context updates must come from the monitored tab.',
        },
      };
    }

    const next = buildPageContextUpdate(current, input);
    if (next === null) {
      return {
        ok: true,
        state: current,
        revision: this.revisionTracker.getRevision(),
      };
    }

    const latest = this.memory.getState();
    if (
      !isActiveSession(latest) ||
      latest.status !== 'recording' ||
      latest.id !== current.id ||
      latest.targetTabId !== senderTabId
    ) {
      return {
        ok: true,
        state: latest,
        revision: this.revisionTracker.getRevision(),
      };
    }

    try {
      await this.enqueueSessionPersist(next);
    } catch {
      return {
        ok: false,
        error: {
          code: 'STORAGE_ERROR',
          message: SESSION_PERSISTENCE_FAILED_MESSAGE,
        },
      };
    }

    this.memory.replaceState(next);
    this.revisionTracker.commit();
    return {
      ok: true,
      state: next,
      revision: this.revisionTracker.getRevision(),
    };
  }

  async startNewCapture(targetTabId?: number): Promise<SessionResponse> {
    await this.ready;
    return this.runStartFlow(targetTabId);
  }

  async deleteSession(): Promise<SessionResponse> {
    await this.ready;
    if (this.restorationError !== undefined) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_ERROR',
          message: this.restorationError,
        },
      };
    }

    const current = this.memory.getState();
    if (current.status === 'idle') {
      return {
        ok: true,
        state: current,
        revision: this.revisionTracker.getRevision(),
      };
    }
    if (current.status !== 'stopped') {
      return {
        ok: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: 'Delete is only allowed while reviewing a session.',
        },
      };
    }

    try {
      await this.options.clearSessionArtifacts?.(current.id);
    } catch {
      return {
        ok: false,
        error: {
          code: 'SESSION_CLEAR_FAILED',
          message: SESSION_CLEAR_FAILED_MESSAGE,
        },
      };
    }

    const planned = applySessionCommand(
      current,
      'reset',
      this.memory.getClock(),
    );
    if (!planned.ok) {
      return planned;
    }

    try {
      await this.enqueueSessionPersist(planned.state);
    } catch {
      return {
        ok: false,
        error: {
          code: 'STORAGE_ERROR',
          message: SESSION_PERSISTENCE_FAILED_MESSAGE,
        },
      };
    }

    const deletedTargetTabId =
      current.status === 'stopped' ? current.targetTabId : undefined;

    this.memory.replaceState(planned.state);
    this.revisionTracker.commit();
    const revision = this.revisionTracker.getRevision();

    if (deletedTargetTabId !== undefined) {
      await this.options.onSessionDeletedOnTab?.({
        tabId: deletedTargetTabId,
        state: planned.state,
        revision,
      });
    }

    return {
      ok: true,
      state: planned.state,
      revision,
    };
  }

  async runSessionCommand(
    command: SessionCommand,
    targetTabId?: number,
  ): Promise<SessionResponse> {
    await this.ready;
    if (this.restorationError !== undefined) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_ERROR',
          message: this.restorationError,
        },
      };
    }

    if (command === 'start') {
      const current = this.memory.getState();
      if (current.status === 'stopped') {
        return {
          ok: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: 'Use Start new capture to replace a reviewed session.',
          },
        };
      }
      return this.runStartFlow(targetTabId);
    }

    const planned = applySessionCommand(
      this.memory.getState(),
      command,
      this.memory.getClock(),
    );
    if (!planned.ok) {
      return planned;
    }

    if (command === 'stop' || command === 'pause' || command === 'resume') {
      this.memory.replaceState(planned.state);
      this.revisionTracker.commit();
      void this.enqueueSessionPersist(planned.state);
      if (command === 'stop') {
        void this.options.onSessionStopped?.(planned.state);
      }
      return {
        ok: true,
        state: planned.state,
        revision: this.revisionTracker.getRevision(),
      };
    }

    return {
      ok: false,
      error: {
        code: 'INVALID_TRANSITION',
        message: 'Unsupported session command.',
      },
    };
  }

  private async runStartFlow(targetTabId?: number): Promise<SessionResponse> {
    const current = this.memory.getState();
    const clearingSessionId = current.status === 'stopped' ? current.id : null;

    try {
      await this.options.clearSessionArtifacts?.(clearingSessionId);
    } catch {
      return {
        ok: false,
        error: {
          code: 'SESSION_CLEAR_FAILED',
          message: SESSION_CLEAR_FAILED_MESSAGE,
        },
      };
    }

    const resolution =
      targetTabId !== undefined
        ? await this.options.tabResolver.resolveHttpTab(targetTabId)
        : await this.options.tabResolver.resolveActiveHttpTab();
    if (!resolution.ok) {
      return {
        ok: false,
        error: {
          code: 'NO_SUPPORTED_TARGET_TAB',
          message: NO_SUPPORTED_TARGET_TAB_MESSAGE,
        },
      };
    }

    const planned = applySessionCommand(
      current,
      'start',
      this.memory.getClock(),
      { binding: resolution.binding },
    );
    if (!planned.ok) {
      return planned;
    }

    const bootstrap = await this.options.ensureTargetTabReady?.(
      resolution.binding.targetTabId,
    );
    if (bootstrap !== undefined && !bootstrap.ok) {
      logCaptureBootstrapDiagnostics({
        ok: false,
        code: bootstrap.code,
        targetTabId: resolution.binding.targetTabId,
      });
      return {
        ok: false,
        error: {
          code: bootstrap.code,
          message: bootstrap.message,
        },
      };
    }
    if (bootstrap !== undefined && bootstrap.ok) {
      logCaptureBootstrapDiagnostics({
        ok: true,
        targetTabId: resolution.binding.targetTabId,
      });
    }

    try {
      await this.enqueueSessionPersist(planned.state);
    } catch {
      return {
        ok: false,
        error: {
          code: 'STORAGE_ERROR',
          message: SESSION_PERSISTENCE_FAILED_MESSAGE,
        },
      };
    }

    this.memory.replaceState(planned.state);
    this.revisionTracker.commit();
    await this.options.onSessionStarted?.(planned.state);

    return {
      ok: true,
      state: planned.state,
      revision: this.revisionTracker.getRevision(),
    };
  }

  private enqueueSessionPersist(snapshot: SessionSnapshot): Promise<void> {
    const run = this.persistChain.then(() => this.storage.write(snapshot));
    this.persistChain = run.then(
      () => {
        this.lastPersisted = snapshot;
      },
      () => undefined,
    );
    return run;
  }
}
