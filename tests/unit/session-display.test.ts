import { describe, expect, it } from 'vitest';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import { formatMonitoredPagePath } from '@/src/sidepanel/session-display';

describe('session display', () => {
  it('shows root pathname as Page: /', () => {
    const label = formatMonitoredPagePath({
      status: 'recording',
      id: 'session-1',
      startedAt: 1,
      pausedAt: null,
      stoppedAt: null,
      ...DEFAULT_TEST_SESSION_TARGET,
      targetUrl: 'https://example.com/',
    });
    expect(label).toBe('Page: /');
  });
});
