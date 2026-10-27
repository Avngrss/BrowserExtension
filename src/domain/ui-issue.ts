import type { SafeElementDescriptor } from '@/src/domain/action';
import type { IssueDisposition } from '@/src/domain/issue-disposition';
import type { UiIssueRuleSeverity } from '@/src/domain/ui-rule';

export type UiIssue = {
  id: string;
  sessionId: string;
  timestamp: number;
  lastSeenAt: number;
  ruleId: string;
  ruleName: string;
  severity: UiIssueRuleSeverity;
  url: string;
  element: SafeElementDescriptor;
  visibleMessage?: string;
  occurrenceCount: number;
  disposition: IssueDisposition;
};

export type UiIssueSubmissionPayload = {
  sessionId: string;
  timestamp: number;
  ruleId: string;
  ruleName: string;
  severity: UiIssueRuleSeverity;
  url: string;
  element: SafeElementDescriptor;
  visibleMessage?: string;
};
