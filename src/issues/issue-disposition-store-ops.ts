import type { IssueDisposition } from '@/src/domain/issue-disposition';
import type { SessionSnapshot } from '@/src/domain/session';
import {
  canReviewIssuesInSession,
  NO_ACTIVE_SESSION_REVIEW_ERROR,
} from '@/src/issues/issue-disposition-session';

export type IssueDispositionStoreErrorCode =
  'INVALID_ISSUE_ID' | 'NO_ACTIVE_SESSION' | 'STORAGE_ERROR';

export type IssueDispositionStoreResult<TIssue> =
  | { ok: true; issues: TIssue[] }
  | {
      ok: false;
      error: {
        code: IssueDispositionStoreErrorCode;
        message: string;
      };
    };

type DispositionStoreContext<
  TIssue extends { id: string; disposition: IssueDisposition },
> = {
  getSessionState: () => SessionSnapshot;
  getIssues: () => TIssue[];
  setIssues: (issues: TIssue[]) => void;
  getLastPersisted: () => TIssue[];
  setLastPersisted: (issues: TIssue[]) => void;
  write: (issues: TIssue[]) => Promise<void>;
};

export async function setStoredIssueDisposition<
  TIssue extends { id: string; disposition: IssueDisposition },
>(
  context: DispositionStoreContext<TIssue>,
  issueId: string,
  disposition: IssueDisposition,
): Promise<IssueDispositionStoreResult<TIssue>> {
  if (!canReviewIssuesInSession(context.getSessionState())) {
    return { ok: false, error: NO_ACTIVE_SESSION_REVIEW_ERROR };
  }

  const issues = context.getIssues();
  const index = issues.findIndex((issue) => issue.id === issueId);
  if (index < 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ISSUE_ID',
        message: 'The requested issue could not be found.',
      },
    };
  }

  const next = [...issues];
  next[index] = { ...next[index]!, disposition };

  try {
    await context.write(next);
  } catch {
    context.setIssues([...context.getLastPersisted()]);
    return {
      ok: false,
      error: {
        code: 'STORAGE_ERROR',
        message: 'The issue disposition could not be saved.',
      },
    };
  }

  context.setIssues(next);
  context.setLastPersisted(next);
  return { ok: true, issues: [...next] };
}

export async function setAllStoredIssueDispositions<
  TIssue extends { id: string; disposition: IssueDisposition },
>(
  context: DispositionStoreContext<TIssue>,
  disposition: IssueDisposition,
): Promise<IssueDispositionStoreResult<TIssue>> {
  if (!canReviewIssuesInSession(context.getSessionState())) {
    return { ok: false, error: NO_ACTIVE_SESSION_REVIEW_ERROR };
  }

  const issues = context.getIssues();
  const next = issues.map((issue) => ({ ...issue, disposition }));

  try {
    await context.write(next);
  } catch {
    context.setIssues([...context.getLastPersisted()]);
    return {
      ok: false,
      error: {
        code: 'STORAGE_ERROR',
        message: 'The issue disposition could not be saved.',
      },
    };
  }

  context.setIssues(next);
  context.setLastPersisted(next);
  return { ok: true, issues: [...next] };
}
