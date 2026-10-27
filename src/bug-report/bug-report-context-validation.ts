import type { BugReportContext } from '@/src/domain/bug-report-context';
import { BUG_REPORT_CONTEXT_FIELD_MAX_LENGTH } from '@/src/domain/bug-report-context';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOptionalField(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > BUG_REPORT_CONTEXT_FIELD_MAX_LENGTH) {
    return undefined;
  }
  return trimmed;
}

export function parseBugReportContext(value: unknown): BugReportContext | null {
  if (!isRecord(value) || typeof value.sessionId !== 'string') {
    return null;
  }
  if (value.sessionId.trim().length === 0) {
    return null;
  }
  const whatHappened = parseOptionalField(value.whatHappened);
  const whatWasExpected = parseOptionalField(value.whatWasExpected);
  return {
    sessionId: value.sessionId,
    whatHappened,
    whatWasExpected,
  };
}
