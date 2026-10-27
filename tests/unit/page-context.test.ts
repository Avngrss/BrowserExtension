import { describe, expect, it } from 'vitest';
import { buildPageContextUpdate } from '@/src/sessions/page-context';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';

const baseSession = {
  status: 'recording' as const,
  id: 'session-1',
  startedAt: 1,
  pausedAt: null,
  stoppedAt: null,
  pageContextUpdatedAt: 1,
  ...DEFAULT_TEST_SESSION_TARGET,
};

describe('buildPageContextUpdate', () => {
  it('updates url and title for the same tab session', () => {
    const next = buildPageContextUpdate(baseSession, {
      url: 'https://example.com/checkout',
      pageTitle: 'Checkout',
      updatedAt: 2,
    });
    expect(next?.targetUrl).toBe('https://example.com/checkout');
    expect(next?.pageTitle).toBe('Checkout');
    expect(next?.id).toBe('session-1');
    expect(next?.targetTabId).toBe(baseSession.targetTabId);
  });

  it('skips no-op updates', () => {
    const next = buildPageContextUpdate(baseSession, {
      url: baseSession.targetUrl,
      pageTitle: baseSession.pageTitle,
      updatedAt: baseSession.pageContextUpdatedAt ?? 1,
    });
    expect(next).toBeNull();
  });
});
