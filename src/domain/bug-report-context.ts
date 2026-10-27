export const BUG_REPORT_CONTEXT_FIELD_MAX_LENGTH = 1_000;

export type BugReportContext = {
  sessionId: string;
  whatHappened?: string;
  whatWasExpected?: string;
};

export function createEmptyBugReportContext(
  sessionId: string,
): BugReportContext {
  return { sessionId };
}
