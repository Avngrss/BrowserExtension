import type { SessionSnapshot } from '@/src/domain/session';
import { InMemorySessionStore } from '@/src/sessions/in-memory-session-store';
import { actionClientMock } from './mock-action-client';
import { consoleIssueClientMock } from './mock-console-issue-client';
import { networkIssueClientMock } from './mock-network-issue-client';
import { uiIssueClientMock } from './mock-ui-issue-client';
import { screenshotEvidenceClientMock } from './mock-screenshot-evidence-client';

const sessionIds = ['session-a', 'session-b', 'session-c'];

let idIndex = 0;
let now = 1_000;
let revision = 1;
let store = createStore();
const listeners = new Set<(state: SessionSnapshot) => void>();
let getStateOverride:
  | (() => Promise<
      | { ok: true; state: SessionSnapshot; revision: number }
      | { ok: false; error: { code: string; message: string } }
    >)
  | undefined;
let deleteSessionShouldFail = false;

function clearSessionDataMocks(): void {
  actionClientMock.setActions([]);
  consoleIssueClientMock.setIssues([]);
  networkIssueClientMock.setIssues([]);
  uiIssueClientMock.setIssues([]);
  screenshotEvidenceClientMock.setEvidence([]);
}

function createStore(): InMemorySessionStore {
  return new InMemorySessionStore({
    createId: () => sessionIds[idIndex++] ?? `session-${idIndex}`,
    now: () => now,
  });
}

function notifyListeners(state: SessionSnapshot): void {
  for (const listener of listeners) {
    listener(state);
  }
}

function runCommand(
  command: 'start' | 'pause' | 'resume' | 'stop',
): Promise<
  | { ok: true; state: SessionSnapshot; revision: number }
  | { ok: false; error: { code: 'INVALID_TRANSITION'; message: string } }
> {
  const response = store.execute(command);
  if (response.ok) {
    if (command === 'start') {
      actionClientMock.setActions([]);
    }
    revision += 1;
    notifyListeners(response.state);
    return Promise.resolve({
      ok: true,
      state: response.state,
      revision,
    });
  }
  return Promise.resolve(response);
}

export const sessionClientMock = {
  reset(): void {
    idIndex = 0;
    now = 1_000;
    revision = 1;
    store = createStore();
    listeners.clear();
    getStateOverride = undefined;
    deleteSessionShouldFail = false;
  },
  setDeleteSessionShouldFail(shouldFail: boolean): void {
    deleteSessionShouldFail = shouldFail;
  },
  setGetStateOverride(override: typeof getStateOverride): void {
    getStateOverride = override;
  },
  setNow(next: number): void {
    now = next;
  },
  getStore(): InMemorySessionStore {
    return store;
  },
  emitState(state: SessionSnapshot): void {
    notifyListeners(state);
  },
  subscribe(listener: (state: SessionSnapshot) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getState(): Promise<
    | { ok: true; state: SessionSnapshot; revision: number }
    | { ok: false; error: { code: string; message: string } }
  > {
    if (getStateOverride !== undefined) {
      return getStateOverride();
    }
    return Promise.resolve({
      ok: true,
      state: store.getState(),
      revision,
    });
  },
  start: () => runCommand('start'),
  pause: () => runCommand('pause'),
  resume: () => runCommand('resume'),
  stop: () => runCommand('stop'),
  startNewCapture: () => runCommand('start'),
  deleteSession: () => {
    const current = store.getState();
    if (current.status !== 'stopped') {
      return Promise.resolve({
        ok: false,
        error: {
          code: 'INVALID_TRANSITION' as const,
          message: 'Delete is only allowed while reviewing a session.',
        },
      });
    }

    if (deleteSessionShouldFail) {
      return Promise.resolve({
        ok: false,
        error: {
          code: 'SESSION_CLEAR_FAILED',
          message: 'Could not clear the current session data.',
        },
      });
    }

    const response = store.execute('reset');
    if (response.ok) {
      clearSessionDataMocks();
      revision += 1;
      notifyListeners(response.state);
      return Promise.resolve({
        ok: true,
        state: response.state,
        revision,
      });
    }
    return Promise.resolve(response);
  },
};

export function resetSessionClientMock(): void {
  sessionClientMock.reset();
}
