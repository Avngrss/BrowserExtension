export type IssueDisposition = 'unexpected' | 'expected' | 'excluded';

export const ISSUE_DISPOSITIONS: readonly IssueDisposition[] = [
  'unexpected',
  'expected',
  'excluded',
];

export type IssueReviewCategory = 'ui' | 'console' | 'network';

export const ISSUE_REVIEW_CATEGORIES: readonly IssueReviewCategory[] = [
  'ui',
  'console',
  'network',
];

export function parseIssueDisposition(value: unknown): IssueDisposition | null {
  if (value === 'unexpected' || value === 'expected' || value === 'excluded') {
    return value;
  }
  return null;
}

export function issueDispositionOrUnexpected(value: unknown): IssueDisposition {
  return parseIssueDisposition(value) ?? 'unexpected';
}

export function parseIssueReviewCategory(
  value: unknown,
): IssueReviewCategory | null {
  if (value === 'ui' || value === 'console' || value === 'network') {
    return value;
  }
  return null;
}
