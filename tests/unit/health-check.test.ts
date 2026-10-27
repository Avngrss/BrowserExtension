import { describe, expect, it } from 'vitest';
import {
  handleRuntimeMessage,
  isHealthCheckRequest,
} from '@/src/messaging/health-check';

describe('health check message handling', () => {
  it('accepts a health check and returns the background response', () => {
    const message = { type: 'HEALTH_CHECK' };

    expect(isHealthCheckRequest(message)).toBe(true);
    expect(handleRuntimeMessage(message)).toEqual({
      status: 'ok',
      source: 'background',
    });
  });

  it('accepts a health check that includes extra fields', () => {
    expect(
      handleRuntimeMessage({ type: 'HEALTH_CHECK', ignored: true }),
    ).toEqual({
      status: 'ok',
      source: 'background',
    });
  });

  it('ignores messages that are not a health check', () => {
    const ignored: unknown[] = [
      null,
      undefined,
      'HEALTH_CHECK',
      1,
      [],
      {},
      { type: 'health_check' },
      { type: 'START_SESSION' },
      { status: 'ok' },
    ];

    for (const message of ignored) {
      expect(isHealthCheckRequest(message)).toBe(false);
      expect(handleRuntimeMessage(message)).toBeUndefined();
    }
  });
});
