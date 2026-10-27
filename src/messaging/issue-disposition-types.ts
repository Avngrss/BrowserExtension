import type {
  IssueDisposition,
  IssueReviewCategory,
} from '@/src/domain/issue-disposition';

export const SET_ISSUE_DISPOSITION = 'SET_ISSUE_DISPOSITION';
export const SET_BULK_ISSUE_DISPOSITION = 'SET_BULK_ISSUE_DISPOSITION';

export type SetIssueDispositionMessage = {
  type: typeof SET_ISSUE_DISPOSITION;
  category: IssueReviewCategory;
  issueId: string;
  disposition: IssueDisposition;
};

export type SetBulkIssueDispositionMessage = {
  type: typeof SET_BULK_ISSUE_DISPOSITION;
  category: IssueReviewCategory | 'all';
  disposition: IssueDisposition;
};

export type IssueDispositionRequestMessage =
  SetIssueDispositionMessage | SetBulkIssueDispositionMessage;

export type IssueDispositionMutationResponse =
  | { ok: true }
  | {
      ok: false;
      error: {
        code:
          | 'INVALID_MESSAGE'
          | 'INVALID_CATEGORY'
          | 'INVALID_ISSUE_ID'
          | 'INVALID_DISPOSITION'
          | 'NO_ACTIVE_SESSION'
          | 'STORAGE_ERROR';
        message: string;
      };
    };
