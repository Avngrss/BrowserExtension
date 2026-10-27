import { describe, expect, it } from 'vitest';
import {
  getSessionDataScope,
  scopedSessionItems,
} from '@/src/hooks/session-data-scope';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';

describe('session data scope', () => {
  it('returns null for idle sessions and filters items by scope', () => {
    expect(getSessionDataScope({ status: 'idle' })).toBeNull();
    expect(
      getSessionDataScope({
        status: 'stopped',
        id: 'session-1',
        startedAt: 1,
        pausedAt: null,
        stoppedAt: 2,
        ...DEFAULT_TEST_SESSION_TARGET,
      }),
    ).toBe('session-1');

    const items = [
      { sessionId: 'session-1', value: 'keep' },
      { sessionId: 'session-old', value: 'drop' },
    ];

    expect(scopedSessionItems(items, null)).toEqual([]);
    expect(scopedSessionItems(items, 'session-1')).toEqual([
      { sessionId: 'session-1', value: 'keep' },
    ]);
  });
});
