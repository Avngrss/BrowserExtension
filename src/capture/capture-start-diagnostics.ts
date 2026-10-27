import type { CaptureReadinessSnapshot } from '@/src/messaging/capture-readiness-types';
import { logDev } from '@/src/utils/dev-log';

export type CaptureStartTimeoutReason =
  | 'no-readiness-report'
  | 'session-mismatch'
  | 'reconnecting'
  | 'collectors-not-ready';

export type CaptureStartDiagnostics = {
  lifecycleStage: 'recording-awaiting-readiness';
  bootstrapResult: 'unknown' | 'pending';
  sessionRevisionMatch: boolean;
  expectedSessionId: string | undefined;
  reportedSessionId: string | undefined;
  reportedRevision: number | undefined;
  collectors: {
    actions: boolean;
    ui: boolean;
    console: boolean;
    network: boolean;
  };
  timeoutReason: CaptureStartTimeoutReason;
};

export function buildCaptureStartDiagnostics(input: {
  readiness: CaptureReadinessSnapshot | null;
  expectedSessionId: string | undefined;
}): CaptureStartDiagnostics {
  const readiness = input.readiness;
  if (readiness === null) {
    return {
      lifecycleStage: 'recording-awaiting-readiness',
      bootstrapResult: 'unknown',
      sessionRevisionMatch: false,
      expectedSessionId: input.expectedSessionId,
      reportedSessionId: undefined,
      reportedRevision: undefined,
      collectors: {
        actions: false,
        ui: false,
        console: false,
        network: false,
      },
      timeoutReason: 'no-readiness-report',
    };
  }

  const sessionRevisionMatch =
    input.expectedSessionId !== undefined &&
    readiness.sessionId === input.expectedSessionId;

  let timeoutReason: CaptureStartTimeoutReason = 'collectors-not-ready';
  if (!sessionRevisionMatch) {
    timeoutReason = 'session-mismatch';
  } else if (readiness.reconnecting) {
    timeoutReason = 'reconnecting';
  }

  return {
    lifecycleStage: 'recording-awaiting-readiness',
    bootstrapResult: 'unknown',
    sessionRevisionMatch,
    expectedSessionId: input.expectedSessionId,
    reportedSessionId: readiness.sessionId,
    reportedRevision: readiness.revision,
    collectors: { ...readiness.collectors },
    timeoutReason,
  };
}

export function captureStartFailureMessage(
  diagnostics: CaptureStartDiagnostics,
): string {
  switch (diagnostics.timeoutReason) {
    case 'no-readiness-report':
      return 'Capture timed out because the page did not confirm collector readiness. Select Try again.';
    case 'session-mismatch':
      return 'Capture timed out because the page session was out of sync. Select Try again.';
    case 'reconnecting':
      return 'Capture timed out while the page was still loading. Wait for the page to finish, then select Try again.';
    case 'collectors-not-ready': {
      const pending = (
        [
          ['Actions', diagnostics.collectors.actions],
          ['UI', diagnostics.collectors.ui],
          ['Console', diagnostics.collectors.console],
          ['Network', diagnostics.collectors.network],
        ] as const
      )
        .filter((entry) => !entry[1])
        .map((entry) => entry[0]);
      if (pending.length === 1) {
        return `Capture timed out waiting for the ${pending[0]} collector. Select Try again.`;
      }
      return 'Capture timed out waiting for page collectors. Select Try again.';
    }
  }
}

export function logCaptureStartDiagnostics(
  diagnostics: CaptureStartDiagnostics,
): void {
  logDev(
    `capture-start-diagnostics ${JSON.stringify({
      lifecycleStage: diagnostics.lifecycleStage,
      bootstrapResult: diagnostics.bootstrapResult,
      sessionRevisionMatch: diagnostics.sessionRevisionMatch,
      expectedSessionId: diagnostics.expectedSessionId,
      reportedSessionId: diagnostics.reportedSessionId,
      reportedRevision: diagnostics.reportedRevision,
      collectors: diagnostics.collectors,
      timeoutReason: diagnostics.timeoutReason,
    })}`,
  );
}

export function logCaptureBootstrapDiagnostics(input: {
  ok: boolean;
  code?: string;
  targetTabId: number;
}): void {
  logDev(
    `capture-start-diagnostics ${JSON.stringify({
      lifecycleStage: 'start-bootstrap',
      bootstrapResult: input.ok ? 'ok' : 'failed',
      bootstrapCode: input.code,
      targetTabId: input.targetTabId,
    })}`,
  );
}
