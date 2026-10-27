import { BUG_REPORT_CONTEXT_FIELD_MAX_LENGTH } from '@/src/domain/bug-report-context';

export function normalizeBugReportContextField(raw: string): string {
  return raw.replace(/\r\n/g, '\n').trim();
}

export function validateBugReportContextField(
  raw: string,
  label: string,
): string | undefined {
  const normalized = normalizeBugReportContextField(raw);
  if (normalized.length === 0) {
    return undefined;
  }
  if (normalized.length > BUG_REPORT_CONTEXT_FIELD_MAX_LENGTH) {
    return `${label} must be ${BUG_REPORT_CONTEXT_FIELD_MAX_LENGTH} characters or fewer.`;
  }
  return undefined;
}

export function bugReportContextFieldForSave(
  raw: string | undefined,
): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const normalized = normalizeBugReportContextField(raw);
  if (normalized.length === 0) {
    return undefined;
  }
  return normalized;
}
