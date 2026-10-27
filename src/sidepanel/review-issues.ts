import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { IssueDisposition } from '@/src/domain/issue-disposition';
import type { IssueReviewCategory } from '@/src/domain/issue-disposition';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type { UiIssue } from '@/src/domain/ui-issue';
import { describeConsoleIssue } from '@/src/console/console-issue-descriptions';
import { describeNetworkIssue } from '@/src/network/network-issue-descriptions';
import { describeUiIssue } from '@/src/ui/ui-issue-descriptions';
import { formatActionTimelinePath } from '@/src/privacy/timeline-url';

export type ReviewIssueRow = {
  category: IssueReviewCategory;
  id: string;
  description: string;
  pathname: string;
  occurrenceCount: number;
  disposition: IssueDisposition;
  timestamp: number;
};

export type ReviewIssueFilter = IssueReviewCategory | 'all';

function mapUi(issue: UiIssue): ReviewIssueRow {
  return {
    category: 'ui',
    id: issue.id,
    description: describeUiIssue(issue),
    pathname: formatActionTimelinePath(issue.url),
    occurrenceCount: issue.occurrenceCount,
    disposition: issue.disposition,
    timestamp: issue.timestamp,
  };
}

function mapConsole(issue: ConsoleIssue): ReviewIssueRow {
  return {
    category: 'console',
    id: issue.id,
    description: describeConsoleIssue(issue),
    pathname: formatActionTimelinePath(issue.url),
    occurrenceCount: issue.occurrenceCount,
    disposition: issue.disposition,
    timestamp: issue.timestamp,
  };
}

function mapNetwork(issue: NetworkIssue): ReviewIssueRow {
  return {
    category: 'network',
    id: issue.id,
    description: describeNetworkIssue(issue),
    pathname: formatActionTimelinePath(issue.url),
    occurrenceCount: issue.occurrenceCount,
    disposition: issue.disposition,
    timestamp: issue.timestamp,
  };
}

export function mergeReviewIssues(input: {
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
}): ReviewIssueRow[] {
  const rows = [
    ...input.uiIssues.map(mapUi),
    ...input.consoleIssues.map(mapConsole),
    ...input.networkIssues.map(mapNetwork),
  ];

  rows.sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return right.timestamp - left.timestamp;
    }
    return left.id.localeCompare(right.id);
  });

  return rows;
}

export function filterReviewIssues(
  issues: ReviewIssueRow[],
  filter: ReviewIssueFilter,
): ReviewIssueRow[] {
  if (filter === 'all') {
    return issues;
  }
  return issues.filter((issue) => issue.category === filter);
}

export function bulkCategoryForFilter(
  filter: ReviewIssueFilter,
): IssueReviewCategory | 'all' {
  return filter;
}
