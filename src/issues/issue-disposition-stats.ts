import type { IssueDisposition } from '@/src/domain/issue-disposition';

export type IssueDispositionBreakdown = Record<IssueDisposition, number>;

export function countIssueDispositions<
  TIssue extends { disposition: IssueDisposition },
>(issues: TIssue[]): IssueDispositionBreakdown {
  const breakdown: IssueDispositionBreakdown = {
    unexpected: 0,
    expected: 0,
    excluded: 0,
  };

  for (const issue of issues) {
    breakdown[issue.disposition] += 1;
  }

  return breakdown;
}

export function hasNonZeroDispositionBreakdown(
  breakdown: IssueDispositionBreakdown,
): boolean {
  return (
    breakdown.expected > 0 || breakdown.excluded > 0 || breakdown.unexpected > 0
  );
}
