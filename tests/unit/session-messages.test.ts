import { describe, expect, it } from 'vitest';
import {
  GET_SESSION_STATE,
  PAUSE_SESSION,
  START_SESSION,
} from '@/src/messaging/session-types';
import {
  handleSessionRequestMessage,
  isSessionRequestMessage,
  isSessionStateUpdatedMessage,
} from '@/src/messaging/session-messages';
import { InMemorySessionStore } from '@/src/sessions/in-memory-session-store';
import { createInMemorySessionBackend } from '@/src/sessions/persistent-session-store';

describe('session message handling', () => {
  it('recognizes session request messages', () => {
    expect(isSessionRequestMessage({ type: GET_SESSION_STATE })).toBe(true);
    expect(isSessionRequestMessage({ type: START_SESSION })).toBe(true);
    expect(isSessionRequestMessage({ type: 'HEALTH_CHECK' })).toBe(false);
  });

  it('returns the current state for GET_SESSION_STATE', async () => {
    const store = new InMemorySessionStore({
      createId: () => 'session-1',
      now: () => 1_000,
    });
    const backend = createInMemorySessionBackend(store);

    await expect(
      handleSessionRequestMessage({ type: GET_SESSION_STATE }, backend),
    ).resolves.toEqual({
      ok: true,
      state: { status: 'idle' },
      revision: 1,
    });
  });

  it('returns typed errors for invalid transitions', async () => {
    const store = new InMemorySessionStore({
      createId: () => 'session-1',
      now: () => 1_000,
    });
    const backend = createInMemorySessionBackend(store);

    const response = await handleSessionRequestMessage(
      { type: PAUSE_SESSION },
      backend,
    );
    expect(response).toEqual({
      ok: false,
      error: {
        code: 'INVALID_TRANSITION',
        message: 'Pause is only allowed while recording.',
      },
    });
    expect(store.getState()).toEqual({ status: 'idle' });
  });

  it('builds session update broadcast messages', () => {
    const message = {
      type: 'SESSION_STATE_UPDATED' as const,
      revision: 2,
      state: {
        status: 'recording' as const,
        id: 'session-1',
        startedAt: 1,
        pausedAt: null,
        stoppedAt: null,
        targetTabId: 42,
        targetUrl: 'https://example.com/',
      },
    };

    expect(isSessionStateUpdatedMessage(message)).toBe(true);
  });
});
