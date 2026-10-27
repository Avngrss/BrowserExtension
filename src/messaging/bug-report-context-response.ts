import type { BugReportContextResponse } from '@/src/messaging/bug-report-context-types';

export function isBugReportContextResponse(
  value: unknown,
): value is BugReportContextResponse {
  if (typeof value !== 'object' || value === null || !('ok' in value)) {
    return false;
  }
  if (value.ok === true) {
    return 'context' in value;
  }
  return (
    'error' in value &&
    typeof (value as { error?: { message?: string } }).error?.message ===
      'string'
  );
}
