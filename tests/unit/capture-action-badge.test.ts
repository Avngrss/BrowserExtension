import { describe, expect, it } from 'vitest';
import { resolveCaptureActionBadge } from '@/src/capture/capture-action-badge';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';

describe('capture action badge', () => {
  it('clears the badge when idle or reviewing', () => {
    expect(
      resolveCaptureActionBadge({ status: 'idle' }, counts()).badgeText,
    ).toBe('');
    expect(
      resolveCaptureActionBadge(
        {
          status: 'stopped',
          id: 's1',
          startedAt: 1,
          pausedAt: null,
          stoppedAt: 2,
          ...DEFAULT_TEST_SESSION_TARGET,
        },
        counts(2),
      ).badgeText,
    ).toBe('');
  });

  it('shows REC, II, and capped issue counts', () => {
    expect(resolveCaptureActionBadge(recording(), counts()).badgeText).toBe(
      'REC',
    );
    expect(resolveCaptureActionBadge(paused(), counts()).badgeText).toBe('II');
    expect(resolveCaptureActionBadge(recording(), counts(1)).badgeText).toBe(
      '1',
    );
    expect(
      resolveCaptureActionBadge(recording(), counts(40, 40, 25)).badgeText,
    ).toBe('99+');
  });
});

function counts(ui = 0, console = 0, network = 0) {
  return { ui, console, network };
}

function recording() {
  return {
    status: 'recording' as const,
    id: 's1',
    startedAt: 1,
    pausedAt: null,
    stoppedAt: null,
    ...DEFAULT_TEST_SESSION_TARGET,
  };
}

function paused() {
  return {
    status: 'paused' as const,
    id: 's1',
    startedAt: 1,
    pausedAt: 2,
    stoppedAt: null,
    ...DEFAULT_TEST_SESSION_TARGET,
  };
}
