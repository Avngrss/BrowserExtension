import { describe, expect, it } from 'vitest';
import {
  SESSION_CLEAR_FAILED_MESSAGE,
  SESSION_PERSISTENCE_FAILED_MESSAGE,
  SESSION_SYNC_FAILED_MESSAGE,
} from '@/src/messaging/session-feedback';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import { InMemorySessionStore } from '@/src/sessions/in-memory-session-store';
import { PersistentSessionStore } from '@/src/sessions/persistent-session-store';
import { createMockSessionStorage } from '../helpers/mock-session-storage';
import type { SessionTargetBinding } from '@/src/domain/session-target';

function mockTabResolver(
  binding: SessionTargetBinding = DEFAULT_TEST_SESSION_TARGET,
) {
  return {
    resolveActiveHttpTab: () => Promise.resolve({ ok: true as const, binding }),
    resolveHttpTab: () => Promise.resolve({ ok: true as const, binding }),
  };
}

function createStorePair(
  initial?: Parameters<typeof createMockSessionStorage>[0],
  options?: Parameters<typeof createMockSessionStorage>[1],
) {
  const storage = createMockSessionStorage(initial, options);
  const memory = new InMemorySessionStore({
    createId: () => 'session-new',
    now: () => 5_000,
  });
  const persistent = new PersistentSessionStore(memory, storage, {
    tabResolver: mockTabResolver(),
  });
  return { storage, memory, persistent };
}

describe('persistent session store', () => {
  it.each([
    {
      status: 'recording' as const,
      id: 'session-1',
      startedAt: 1_000,
      pausedAt: null,
      stoppedAt: null,
      ...DEFAULT_TEST_SESSION_TARGET,
    },
    {
      status: 'paused' as const,
      id: 'session-1',
      startedAt: 1_000,
      pausedAt: 1_500,
      stoppedAt: null,
      ...DEFAULT_TEST_SESSION_TARGET,
    },
    {
      status: 'stopped' as const,
      id: 'session-1',
      startedAt: 1_000,
      pausedAt: null,
      stoppedAt: 2_000,
      ...DEFAULT_TEST_SESSION_TARGET,
    },
    { status: 'idle' as const },
  ])('restores valid stored state %#', async (stored) => {
    const initial = stored.status === 'idle' ? undefined : stored;
    const { persistent, memory } = createStorePair(initial);
    await persistent.waitUntilReady();
    expect(memory.getState()).toEqual(stored);
    expect(await persistent.getSessionState()).toEqual({
      ok: true,
      state: stored,
      revision: 1,
    });
  });

  it('falls back to idle when storage is empty', async () => {
    const { persistent, storage } = createStorePair();
    await persistent.waitUntilReady();
    expect(await persistent.getSessionState()).toEqual({
      ok: true,
      state: { status: 'idle' },
      revision: 1,
    });
    expect(storage.getStored()).toBeUndefined();
  });

  it('removes invalid stored data and restores idle', async () => {
    const storage = createMockSessionStorage(undefined);
    storage.setStored({
      status: 'recording',
      id: 'session-1',
      startedAt: 1,
      pausedAt: 1,
      stoppedAt: null,
    } as never);
    const memory = new InMemorySessionStore({
      createId: () => 'session-new',
      now: () => 5_000,
    });
    const persistent = new PersistentSessionStore(memory, storage, {
      tabResolver: mockTabResolver(),
    });
    await persistent.waitUntilReady();

    expect(storage.getStored()).toBeUndefined();
    expect(await persistent.getSessionState()).toEqual({
      ok: true,
      state: { status: 'idle' },
      revision: 1,
    });
  });

  it('persists after every successful transition', async () => {
    const { persistent, storage } = createStorePair();
    await persistent.waitUntilReady();

    await persistent.runSessionCommand('start');
    await persistent.waitUntilPersistIdle();
    expect(storage.getStored()).toMatchObject({ status: 'recording' });

    await persistent.runSessionCommand('pause');
    await persistent.waitUntilPersistIdle();
    expect(storage.getStored()).toMatchObject({ status: 'paused' });

    await persistent.runSessionCommand('resume');
    await persistent.waitUntilPersistIdle();
    expect(storage.getStored()).toMatchObject({ status: 'recording' });

    await persistent.runSessionCommand('stop');
    await persistent.waitUntilPersistIdle();
    expect(storage.getStored()).toMatchObject({ status: 'stopped' });
  });

  it('completes stop in memory when session persistence write fails', async () => {
    const storage = createMockSessionStorage(undefined);
    const persistWrite = storage.write.bind(storage);
    storage.write = (snapshot) => {
      if (snapshot.status === 'stopped') {
        return Promise.reject(new Error('write failed'));
      }
      return persistWrite(snapshot);
    };
    const memory = new InMemorySessionStore({
      createId: () => 'session-new',
      now: () => 5_000,
    });
    const persistent = new PersistentSessionStore(memory, storage, {
      tabResolver: mockTabResolver(),
    });
    await persistent.waitUntilReady();

    await persistent.runSessionCommand('start');
    await persistent.waitUntilPersistIdle();

    const stopResponse = await persistent.runSessionCommand('stop');
    expect(stopResponse.ok).toBe(true);
    if (stopResponse.ok) {
      expect(stopResponse.state).toMatchObject({ status: 'stopped' });
    }
    expect(memory.getState()).toMatchObject({ status: 'stopped' });
  });

  it('does not write or mutate memory on invalid transitions', async () => {
    const { persistent, storage, memory } = createStorePair();
    await persistent.waitUntilReady();

    const response = await persistent.runSessionCommand('pause');
    expect(response).toEqual({
      ok: false,
      error: {
        code: 'INVALID_TRANSITION',
        message: 'Pause is only allowed while recording.',
      },
    });
    expect(storage.getStored()).toBeUndefined();
    expect(memory.getState()).toEqual({ status: 'idle' });
  });

  it('reports restoration failure after storage read errors', async () => {
    const { persistent } = createStorePair(undefined, {
      readError: new Error('read failed'),
    });
    await persistent.waitUntilReady();

    expect(await persistent.getSessionState()).toEqual({
      ok: false,
      error: {
        code: 'STORAGE_ERROR',
        message: SESSION_SYNC_FAILED_MESSAGE,
      },
    });
  });

  it('rolls back memory when persistence fails', async () => {
    const storage = createMockSessionStorage(undefined, {
      writeError: new Error('write failed'),
    });
    const memory = new InMemorySessionStore({
      createId: () => 'session-new',
      now: () => 5_000,
    });
    const persistent = new PersistentSessionStore(memory, storage, {
      tabResolver: mockTabResolver(),
    });
    await persistent.waitUntilReady();

    const response = await persistent.runSessionCommand('start');
    expect(response).toEqual({
      ok: false,
      error: {
        code: 'STORAGE_ERROR',
        message: SESSION_PERSISTENCE_FAILED_MESSAGE,
      },
    });
    expect(memory.getState()).toEqual({ status: 'idle' });
    expect(storage.getStored()).toBeUndefined();
    expect(persistent.getLastPersistedState()).toEqual({ status: 'idle' });
  });

  it('waits for initialization before handling commands', async () => {
    let resolveRead: ((value: unknown) => void) | undefined;
    const readPromise = new Promise<unknown>((resolve) => {
      resolveRead = resolve;
    });
    const storage = {
      read: () => readPromise,
      write: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    };
    const memory = new InMemorySessionStore({
      createId: () => 'session-new',
      now: () => 5_000,
    });
    const persistent = new PersistentSessionStore(memory, storage, {
      tabResolver: mockTabResolver(),
    });

    const pendingGet = persistent.getSessionState();
    const pendingStart = persistent.runSessionCommand('start');
    resolveRead?.({
      status: 'paused',
      id: 'session-1',
      startedAt: 100,
      pausedAt: 200,
      stoppedAt: null,
      ...DEFAULT_TEST_SESSION_TARGET,
    });

    expect(await pendingGet).toEqual({
      ok: true,
      state: {
        status: 'paused',
        id: 'session-1',
        startedAt: 100,
        pausedAt: 200,
        stoppedAt: null,
        ...DEFAULT_TEST_SESSION_TARGET,
      },
      revision: 1,
    });

    const startResponse = await pendingStart;
    expect(startResponse.ok).toBe(false);
    expect(memory.getState().status).toBe('paused');
  });

  it('clears artifacts before start and delete, and blocks start from stopped', async () => {
    let clearedFor: string | null | undefined;
    const memory = new InMemorySessionStore({
      createId: () => 'session-new',
      now: () => 5_000,
    });
    const withClear = new PersistentSessionStore(
      memory,
      createMockSessionStorage(),
      {
        tabResolver: mockTabResolver(),
        clearSessionArtifacts: (sessionId) => {
          clearedFor = sessionId;
          return Promise.resolve();
        },
      },
    );
    await withClear.waitUntilReady();
    await withClear.runSessionCommand('start');
    expect(clearedFor).toBe(null);

    await withClear.runSessionCommand('stop');
    const blocked = await withClear.runSessionCommand('start');
    expect(blocked.ok).toBe(false);

    clearedFor = undefined;
    await withClear.startNewCapture();
    expect(clearedFor).toBe('session-new');

    await withClear.runSessionCommand('stop');
    clearedFor = undefined;
    await withClear.deleteSession();
    expect(clearedFor).toBe('session-new');
    expect(memory.getState()).toEqual({ status: 'idle' });
  });

  it('awaits target-tab idle sync before delete returns', async () => {
    let releaseSync: (() => void) | undefined;
    const syncGate = new Promise<void>((resolve) => {
      releaseSync = resolve;
    });
    const memory = new InMemorySessionStore({
      createId: () => 'session-new',
      now: () => 5_000,
    });
    const persistent = new PersistentSessionStore(
      memory,
      createMockSessionStorage(),
      {
        tabResolver: mockTabResolver(),
        onSessionDeletedOnTab: () => syncGate,
      },
    );
    await persistent.waitUntilReady();
    await persistent.runSessionCommand('start');
    await persistent.runSessionCommand('stop');

    let settled = false;
    const deletePromise = persistent.deleteSession().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    releaseSync?.();
    await deletePromise;
    expect(settled).toBe(true);
    expect(memory.getState()).toEqual({ status: 'idle' });
  });

  it('keeps a stopped session when cleanup fails', async () => {
    let failClear = false;
    const memory = new InMemorySessionStore({
      createId: () => 'session-new',
      now: () => 5_000,
    });
    const persistent = new PersistentSessionStore(
      memory,
      createMockSessionStorage(),
      {
        tabResolver: mockTabResolver(),
        clearSessionArtifacts: () => {
          if (failClear) {
            return Promise.reject(new Error('clear failed'));
          }
          return Promise.resolve();
        },
      },
    );
    await persistent.waitUntilReady();
    await persistent.runSessionCommand('start');
    await persistent.runSessionCommand('stop');
    failClear = true;

    const response = await persistent.startNewCapture();
    expect(response).toEqual({
      ok: false,
      error: {
        code: 'SESSION_CLEAR_FAILED',
        message: SESSION_CLEAR_FAILED_MESSAGE,
      },
    });
    expect(memory.getState()).toMatchObject({ status: 'stopped' });
  });
});
