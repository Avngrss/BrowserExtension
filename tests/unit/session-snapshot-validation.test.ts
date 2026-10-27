import { describe, expect, it } from 'vitest';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import { parseSessionSnapshot } from '@/src/sessions/session-snapshot-validation';

describe('session snapshot validation', () => {
  it('accepts idle snapshots', () => {
    expect(parseSessionSnapshot({ status: 'idle' })).toEqual({
      status: 'idle',
    });
  });

  it('accepts recording, paused, and stopped snapshots', () => {
    expect(
      parseSessionSnapshot({
        status: 'recording',
        id: 'session-1',
        startedAt: 100,
        pausedAt: null,
        stoppedAt: null,
        ...DEFAULT_TEST_SESSION_TARGET,
      }),
    ).toEqual({
      status: 'recording',
      id: 'session-1',
      startedAt: 100,
      pausedAt: null,
      stoppedAt: null,
      ...DEFAULT_TEST_SESSION_TARGET,
    });

    expect(
      parseSessionSnapshot({
        status: 'paused',
        id: 'session-1',
        startedAt: 100,
        pausedAt: 200,
        stoppedAt: null,
        ...DEFAULT_TEST_SESSION_TARGET,
      }),
    ).toMatchObject({ status: 'paused' });

    expect(
      parseSessionSnapshot({
        status: 'stopped',
        id: 'session-1',
        startedAt: 100,
        pausedAt: 200,
        stoppedAt: 300,
        ...DEFAULT_TEST_SESSION_TARGET,
      }),
    ).toMatchObject({ status: 'stopped' });
  });

  it('rejects malformed snapshots', () => {
    expect(parseSessionSnapshot(null)).toBeNull();
    expect(parseSessionSnapshot({ status: 'recording' })).toBeNull();
    expect(
      parseSessionSnapshot({
        status: 'recording',
        id: '',
        startedAt: 100,
        pausedAt: null,
        stoppedAt: null,
        ...DEFAULT_TEST_SESSION_TARGET,
      }),
    ).toBeNull();
    expect(
      parseSessionSnapshot({
        status: 'paused',
        id: 'session-1',
        startedAt: 100,
        pausedAt: 50,
        stoppedAt: null,
        ...DEFAULT_TEST_SESSION_TARGET,
      }),
    ).toBeNull();
    expect(parseSessionSnapshot({ status: 'idle', id: 'extra' })).toBeNull();
  });
});
