import { describe, expect, it } from 'vitest';
import {
  buildCaptureStartDiagnostics,
  captureStartFailureMessage,
} from '@/src/capture/capture-start-diagnostics';

describe('capture start diagnostics', () => {
  it('describes missing readiness reports', () => {
    const diagnostics = buildCaptureStartDiagnostics({
      readiness: null,
      expectedSessionId: 'session-1',
    });
    expect(diagnostics.timeoutReason).toBe('no-readiness-report');
    expect(captureStartFailureMessage(diagnostics)).toContain('Try again');
  });

  it('names a single pending collector', () => {
    const diagnostics = buildCaptureStartDiagnostics({
      readiness: {
        sessionId: 'session-1',
        revision: 2,
        tabId: 1,
        reconnecting: false,
        updatedAt: Date.now(),
        collectors: {
          actions: true,
          ui: false,
          console: true,
          network: true,
        },
      },
      expectedSessionId: 'session-1',
    });
    expect(captureStartFailureMessage(diagnostics)).toContain('UI collector');
  });
});
