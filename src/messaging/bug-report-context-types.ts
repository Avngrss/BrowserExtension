import type { BugReportContext } from '@/src/domain/bug-report-context';

export const GET_BUG_REPORT_CONTEXT = 'GET_BUG_REPORT_CONTEXT';
export const SAVE_BUG_REPORT_CONTEXT = 'SAVE_BUG_REPORT_CONTEXT';
export const BUG_REPORT_CONTEXT_UPDATED = 'BUG_REPORT_CONTEXT_UPDATED';

export type BugReportContextRequestType =
  typeof GET_BUG_REPORT_CONTEXT | typeof SAVE_BUG_REPORT_CONTEXT;

export type GetBugReportContextMessage = {
  type: typeof GET_BUG_REPORT_CONTEXT;
  sessionId: string;
};

export type SaveBugReportContextMessage = {
  type: typeof SAVE_BUG_REPORT_CONTEXT;
  sessionId: string;
  whatHappened?: string;
  whatWasExpected?: string;
};

export type BugReportContextRequestMessage =
  GetBugReportContextMessage | SaveBugReportContextMessage;

export type BugReportContextUpdatedMessage = {
  type: typeof BUG_REPORT_CONTEXT_UPDATED;
  context: BugReportContext | null;
};

export type BugReportContextResponse =
  | { ok: true; context: BugReportContext | null }
  | { ok: false; error: { code: string; message: string } };
