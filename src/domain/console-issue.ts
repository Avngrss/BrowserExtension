import type { IssueDisposition } from '@/src/domain/issue-disposition';

export type ConsoleIssueCategory =
  'console-error' | 'uncaught-error' | 'unhandled-rejection';

export type ConsoleIssue = {
  id: string;
  sessionId: string;
  timestamp: number;
  lastSeenAt: number;
  category: ConsoleIssueCategory;
  message: string;
  url: string;
  stack?: string;
  occurrenceCount: number;
  disposition: IssueDisposition;
};

export type ConsoleIssueSubmissionPayload = {
  sessionId: string;
  timestamp: number;
  category: ConsoleIssueCategory;
  message: string;
  url: string;
  stack?: string;
};
