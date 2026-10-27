import type {
  IssueDisposition,
  IssueReviewCategory,
} from '@/src/domain/issue-disposition';
import { consoleIssueClientMock } from './mock-console-issue-client';
import { networkIssueClientMock } from './mock-network-issue-client';
import { uiIssueClientMock } from './mock-ui-issue-client';

function updateCategoryDisposition(
  category: IssueReviewCategory,
  issueId: string,
  disposition: IssueDisposition,
): boolean {
  if (category === 'console') {
    const issues = consoleIssueClientMock.getIssuesSnapshot();
    const index = issues.findIndex((issue) => issue.id === issueId);
    if (index < 0) {
      return false;
    }
    const next = [...issues];
    next[index] = { ...next[index]!, disposition };
    consoleIssueClientMock.setIssues(next);
    return true;
  }

  if (category === 'network') {
    const issues = networkIssueClientMock.getIssuesSnapshot();
    const index = issues.findIndex((issue) => issue.id === issueId);
    if (index < 0) {
      return false;
    }
    const next = [...issues];
    next[index] = { ...next[index]!, disposition };
    networkIssueClientMock.setIssues(next);
    return true;
  }

  const issues = uiIssueClientMock.getIssuesSnapshot();
  const index = issues.findIndex((issue) => issue.id === issueId);
  if (index < 0) {
    return false;
  }
  const next = [...issues];
  next[index] = { ...next[index]!, disposition };
  uiIssueClientMock.setIssues(next);
  return true;
}

function updateBulkDisposition(
  category: IssueReviewCategory | 'all',
  disposition: IssueDisposition,
): void {
  if (category === 'all' || category === 'console') {
    consoleIssueClientMock.setIssues(
      consoleIssueClientMock
        .getIssuesSnapshot()
        .map((issue) => ({ ...issue, disposition })),
    );
  }
  if (category === 'all' || category === 'network') {
    networkIssueClientMock.setIssues(
      networkIssueClientMock
        .getIssuesSnapshot()
        .map((issue) => ({ ...issue, disposition })),
    );
  }
  if (category === 'all' || category === 'ui') {
    uiIssueClientMock.setIssues(
      uiIssueClientMock
        .getIssuesSnapshot()
        .map((issue) => ({ ...issue, disposition })),
    );
  }
}

export const issueDispositionClientMock = {
  reset(): void {
    // No local state; tied to issue list mocks.
  },
  setIssueDisposition(input: {
    category: IssueReviewCategory;
    issueId: string;
    disposition: IssueDisposition;
  }): Promise<{ ok: true } | { ok: false; error: { code: string } }> {
    const updated = updateCategoryDisposition(
      input.category,
      input.issueId,
      input.disposition,
    );
    if (!updated) {
      return Promise.resolve({
        ok: false,
        error: { code: 'INVALID_ISSUE_ID' },
      });
    }
    return Promise.resolve({ ok: true });
  },
  setBulkDisposition(input: {
    category: IssueReviewCategory | 'all';
    disposition: IssueDisposition;
  }): Promise<{ ok: true }> {
    updateBulkDisposition(input.category, input.disposition);
    return Promise.resolve({ ok: true });
  },
};

export function resetIssueDispositionClientMock(): void {
  issueDispositionClientMock.reset();
}
