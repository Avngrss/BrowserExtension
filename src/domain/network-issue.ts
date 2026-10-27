import type { IssueDisposition } from '@/src/domain/issue-disposition';

export type NetworkIssueSource = 'fetch' | 'xhr';

export type NetworkIssueCategory =
  'http-error' | 'network-failure' | 'timeout' | 'aborted';

export type NetworkIssue = {
  id: string;
  sessionId: string;
  timestamp: number;
  lastSeenAt: number;
  source: NetworkIssueSource;
  category: NetworkIssueCategory;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  durationMs?: number;
  failureMessage?: string;
  occurrenceCount: number;
  disposition: IssueDisposition;
};

export type NetworkIssueSubmissionPayload = {
  sessionId: string;
  timestamp: number;
  source: NetworkIssueSource;
  category: NetworkIssueCategory;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  durationMs?: number;
  failureMessage?: string;
};
