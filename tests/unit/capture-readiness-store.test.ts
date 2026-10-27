import { describe, expect, it } from 'vitest';
import { CaptureReadinessStore } from '@/src/sessions/capture-readiness-store';

describe('CaptureReadinessStore', () => {
  it('ignores readiness reports for the wrong revision', () => {
    const store = new CaptureReadinessStore();
    const accepted = store.applyReport({
      sessionId: 'session-1',
      revision: 2,
      tabId: 1,
      collectors: {
        actions: true,
        ui: true,
        console: true,
        network: true,
      },
      expectedSessionId: 'session-1',
      expectedRevision: 2,
    });
    expect(accepted).not.toBeNull();

    const stale = store.applyReport({
      sessionId: 'session-1',
      revision: 1,
      tabId: 1,
      collectors: {
        actions: true,
        ui: true,
        console: true,
        network: true,
      },
      expectedSessionId: 'session-1',
      expectedRevision: 2,
    });
    expect(stale).toBeNull();
    expect(store.getSnapshot()?.revision).toBe(2);
  });
});
