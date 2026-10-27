import { describe, expect, it } from 'vitest';
import { createIdleSessionSnapshot } from '@/src/domain/session';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import { applySessionCommand } from '@/src/sessions/lifecycle';
import { InMemorySessionStore } from '@/src/sessions/in-memory-session-store';

function createClock(ids: string[], startAt = 1_000) {
  let index = 0;
  let now = startAt;
  return {
    createId: () => ids[index++] ?? `generated-${index}`,
    now: () => now,
    advance: (by: number) => {
      now += by;
    },
  };
}

describe('session lifecycle', () => {
  it('resets a stopped session to idle', () => {
    const clock = createClock(['session-1']);
    let state = createIdleSessionSnapshot();
    const started = applySessionCommand(state, 'start', clock, {
      binding: DEFAULT_TEST_SESSION_TARGET,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    state = started.state;
    const stopped = applySessionCommand(state, 'stop', clock);
    expect(stopped.ok).toBe(true);
    if (!stopped.ok) {
      return;
    }
    state = stopped.state;
    const reset = applySessionCommand(state, 'reset', clock);
    expect(reset).toEqual({ ok: true, state: createIdleSessionSnapshot() });
  });

  it('starts from idle and moves through recording, paused, and stopped', () => {
    const clock = createClock(['session-1']);
    let state = createIdleSessionSnapshot();

    const started = applySessionCommand(state, 'start', clock, {
      binding: DEFAULT_TEST_SESSION_TARGET,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    state = started.state;
    expect(state).toEqual({
      status: 'recording',
      id: 'session-1',
      startedAt: 1_000,
      pausedAt: null,
      stoppedAt: null,
      pageContextUpdatedAt: 1_000,
      ...DEFAULT_TEST_SESSION_TARGET,
    });

    clock.advance(500);
    const paused = applySessionCommand(state, 'pause', clock);
    expect(paused.ok).toBe(true);
    if (!paused.ok) {
      return;
    }
    state = paused.state;
    expect(state.status).toBe('paused');

    const resumed = applySessionCommand(state, 'resume', clock);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) {
      return;
    }
    state = resumed.state;
    expect(state.status).toBe('recording');

    clock.advance(200);
    const stopped = applySessionCommand(state, 'stop', clock);
    expect(stopped.ok).toBe(true);
    if (!stopped.ok) {
      return;
    }
    expect(stopped.state).toEqual({
      status: 'stopped',
      id: 'session-1',
      startedAt: 1_000,
      pausedAt: null,
      stoppedAt: 1_700,
      pageContextUpdatedAt: 1_000,
      ...DEFAULT_TEST_SESSION_TARGET,
    });
  });

  it('rejects invalid transitions without changing store state', () => {
    const clock = createClock(['session-1']);
    const store = new InMemorySessionStore(clock);

    expect(store.execute('pause')).toEqual({
      ok: false,
      error: {
        code: 'INVALID_TRANSITION',
        message: 'Pause is only allowed while recording.',
      },
    });
    expect(store.getState()).toEqual({ status: 'idle' });

    store.execute('start');
    expect(store.execute('start')).toEqual({
      ok: false,
      error: {
        code: 'INVALID_TRANSITION',
        message: 'Start is only allowed from idle or stopped.',
      },
    });
    expect(store.getState().status).toBe('recording');
  });

  it('creates a new session id when starting after stopped', () => {
    const clock = createClock(['session-1', 'session-2']);
    const store = new InMemorySessionStore(clock);

    store.execute('start');
    store.execute('stop');
    store.execute('start');

    expect(store.getState()).toMatchObject({
      status: 'recording',
      id: 'session-2',
    });
  });
});
