import type {
  ActionSubmissionPayload,
  CapturedAction,
} from '@/src/domain/action';
import type { SessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';
import { parseActionSubmissionPayload } from '@/src/actions/action-validation';
import { parseCapturedActionList } from '@/src/actions/action-validation';
import type { ActionStorageAdapter } from '@/src/actions/action-storage';

export const MAX_STORED_ACTIONS = 100;

export type ActionListResponse =
  | { ok: true; actions: CapturedAction[] }
  | {
      ok: false;
      error: {
        code: 'STORAGE_ERROR' | 'ACTION_LIMIT_REACHED' | 'INVALID_ACTION';
        message: string;
      };
    };

export type ActionSubmitResponse =
  | { ok: true; actions: CapturedAction[] }
  | {
      ok: false;
      error: {
        code:
          | 'STORAGE_ERROR'
          | 'ACTION_LIMIT_REACHED'
          | 'INVALID_ACTION'
          | 'STALE_ACTION';
        message: string;
      };
    };

export type ActionStoreDependencies = {
  getSessionState: () => SessionSnapshot;
  createActionId: () => string;
  getMaxStoredActions?: () => number;
};

export class ActionStore {
  private readonly ready: Promise<void>;
  private actions: CapturedAction[] = [];
  private lastPersisted: CapturedAction[] = [];

  constructor(
    private readonly storage: ActionStorageAdapter,
    private readonly deps: ActionStoreDependencies,
  ) {
    this.ready = this.restoreFromStorage();
  }

  waitUntilReady(): Promise<void> {
    return this.ready;
  }

  getActions(): CapturedAction[] {
    return [...this.actions];
  }

  private async restoreFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.read();
      if (stored === undefined || stored === null) {
        this.actions = [];
        this.lastPersisted = [];
        return;
      }

      const parsed = parseCapturedActionList(stored);
      if (parsed === null) {
        await this.storage.remove();
        this.actions = [];
        this.lastPersisted = [];
        return;
      }

      this.actions = parsed.slice(0, this.getMaxStoredActions());
      this.lastPersisted = [...this.actions];
    } catch {
      this.actions = [];
      this.lastPersisted = [];
    }
  }

  async clearActions(): Promise<void> {
    await this.ready;
    this.actions = [];
    try {
      await this.storage.remove();
      this.lastPersisted = [];
    } catch {
      this.actions = [...this.lastPersisted];
      throw new Error('Action storage write failed.');
    }
  }

  async getActionList(): Promise<ActionListResponse> {
    await this.ready;
    return { ok: true, actions: this.getActions() };
  }

  async submitAction(
    rawPayload: unknown,
    senderTabId: number | undefined,
  ): Promise<ActionSubmitResponse> {
    await this.ready;

    const payload = parseActionSubmissionPayload(rawPayload);
    if (payload === null) {
      return {
        ok: false,
        error: {
          code: 'INVALID_ACTION',
          message: 'The submitted action is invalid.',
        },
      };
    }

    const session = this.deps.getSessionState();
    if (!isActiveSession(session) || session.status !== 'recording') {
      return {
        ok: false,
        error: {
          code: 'STALE_ACTION',
          message: 'Actions are only accepted while recording.',
        },
      };
    }

    if (payload.sessionId !== session.id) {
      return {
        ok: false,
        error: {
          code: 'STALE_ACTION',
          message: 'The submitted action does not match the active session.',
        },
      };
    }

    if (senderTabId === undefined || senderTabId !== session.targetTabId) {
      return {
        ok: false,
        error: {
          code: 'STALE_ACTION',
          message: 'Actions are only accepted from the monitored tab.',
        },
      };
    }

    if (this.actions.length >= this.getMaxStoredActions()) {
      return {
        ok: false,
        error: {
          code: 'ACTION_LIMIT_REACHED',
          message: 'The action limit for this session has been reached.',
        },
      };
    }

    const action = this.createCapturedAction(payload);
    const nextActions = [...this.actions, action];

    try {
      await this.storage.write(nextActions);
    } catch {
      return {
        ok: false,
        error: {
          code: 'STORAGE_ERROR',
          message: 'The action could not be saved.',
        },
      };
    }

    this.actions = nextActions;
    this.lastPersisted = nextActions;
    return { ok: true, actions: this.getActions() };
  }

  private createCapturedAction(
    payload: ActionSubmissionPayload,
  ): CapturedAction {
    const id = this.deps.createActionId();
    return { id, ...payload } as CapturedAction;
  }

  private getMaxStoredActions(): number {
    return this.deps.getMaxStoredActions?.() ?? MAX_STORED_ACTIONS;
  }
}
