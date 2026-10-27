import type { SessionCommand, SessionSnapshot } from '@/src/domain/session';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import {
  applySessionCommand,
  createInitialSessionSnapshot,
  type ApplySessionCommandOptions,
} from '@/src/sessions/lifecycle';

export type SessionCommandResponse =
  | {
      ok: true;
      state: SessionSnapshot;
    }
  | {
      ok: false;
      error: {
        code: 'INVALID_TRANSITION';
        message: string;
      };
    };

export type SessionClock = {
  createId: () => string;
  now: () => number;
};

export class InMemorySessionStore {
  private state: SessionSnapshot = createInitialSessionSnapshot();

  constructor(private readonly clock: SessionClock) {}

  getState(): SessionSnapshot {
    return this.state;
  }

  getClock(): SessionClock {
    return this.clock;
  }

  replaceState(state: SessionSnapshot): void {
    this.state = state;
  }

  execute(
    command: SessionCommand,
    options: ApplySessionCommandOptions = {},
  ): SessionCommandResponse {
    const resolvedOptions =
      command === 'start' && options.binding === undefined
        ? { binding: DEFAULT_TEST_SESSION_TARGET }
        : options;
    const result = applySessionCommand(
      this.state,
      command,
      this.clock,
      resolvedOptions,
    );
    if (!result.ok) {
      return result;
    }

    this.state = result.state;
    return { ok: true, state: this.state };
  }
}

export function createDefaultSessionStore(): InMemorySessionStore {
  return new InMemorySessionStore({
    createId: () => crypto.randomUUID(),
    now: () => Date.now(),
  });
}
