import { describe, expect, it, vi } from 'vitest';
import { ContentActionCollector } from '@/src/capture/content-action-collector';
import { ContentSessionSync } from '@/src/capture/content-session-sync';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';

const recordingSession = {
  status: 'recording' as const,
  id: 'session-1',
  startedAt: 1_000,
  pausedAt: null,
  stoppedAt: null,
  ...DEFAULT_TEST_SESSION_TARGET,
};

function createSync() {
  const collector = new ContentActionCollector({
    getLocation: () => ({ href: 'https://example.com/' }) as Location,
    getDocumentTitle: () => 'Example',
    submitAction: vi.fn(),
  });
  return { sync: new ContentSessionSync([collector]), collector };
}

describe('content session sync', () => {
  it('starts collection for an already-recording session on initialization', () => {
    const { sync } = createSync();
    sync.setTabId(DEFAULT_TEST_SESSION_TARGET.targetTabId);
    sync.applySessionState(recordingSession, 2);

    expect(sync.getAppliedRevision()).toBe(2);
  });

  it('does not apply stale initialization state after a newer broadcast', () => {
    const { sync } = createSync();
    sync.setTabId(DEFAULT_TEST_SESSION_TARGET.targetTabId);

    sync.applySessionState(recordingSession, 3);
    sync.applySessionState({ status: 'idle' }, 2);

    expect(sync.getAppliedRevision()).toBe(3);
  });

  it('applies newer broadcasts after initialization responses arrive', () => {
    const { sync } = createSync();
    sync.setTabId(DEFAULT_TEST_SESSION_TARGET.targetTabId);

    sync.applySessionState({ status: 'idle' }, 1);
    sync.applySessionState(recordingSession, 4);

    expect(sync.getAppliedRevision()).toBe(4);
  });
});
