import type { CaptureReadinessSnapshot } from '@/src/messaging/capture-readiness-types';
import {
  CAPTURE_READINESS_UPDATED,
  GET_CAPTURE_READINESS,
  REPORT_COLLECTOR_READINESS,
  type GetCaptureReadinessMessage,
  type ReportCollectorReadinessMessage,
} from '@/src/messaging/capture-readiness-types';
import type { CaptureReadinessStore } from '@/src/sessions/capture-readiness-store';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCollectorFlags(
  value: unknown,
): ReportCollectorReadinessMessage['collectors'] | null {
  if (!isRecord(value)) {
    return null;
  }
  const keys = ['actions', 'ui', 'console', 'network'] as const;
  for (const key of keys) {
    if (typeof value[key] !== 'boolean') {
      return null;
    }
  }
  return {
    actions: value.actions === true,
    ui: value.ui === true,
    console: value.console === true,
    network: value.network === true,
  };
}

export function isReportCollectorReadinessMessage(
  message: unknown,
): message is ReportCollectorReadinessMessage {
  if (!isRecord(message) || message.type !== REPORT_COLLECTOR_READINESS) {
    return false;
  }
  const collectors = parseCollectorFlags(message.collectors);
  return (
    typeof message.sessionId === 'string' &&
    typeof message.revision === 'number' &&
    Number.isFinite(message.revision) &&
    typeof message.tabId === 'number' &&
    collectors !== null
  );
}

export function isGetCaptureReadinessMessage(
  message: unknown,
): message is GetCaptureReadinessMessage {
  return isRecord(message) && message.type === GET_CAPTURE_READINESS;
}

export function createCaptureReadinessUpdatedMessage(
  readiness: CaptureReadinessSnapshot | null,
): {
  type: typeof CAPTURE_READINESS_UPDATED;
  readiness: CaptureReadinessSnapshot | null;
} {
  return {
    type: CAPTURE_READINESS_UPDATED,
    readiness,
  };
}

export function handleReportCollectorReadiness(
  message: ReportCollectorReadinessMessage,
  store: CaptureReadinessStore,
  expected: { sessionId: string | undefined; revision: number },
): CaptureReadinessSnapshot | null {
  return store.applyReport({
    sessionId: message.sessionId,
    revision: message.revision,
    tabId: message.tabId,
    collectors: message.collectors,
    expectedSessionId: expected.sessionId,
    expectedRevision: expected.revision,
  });
}
