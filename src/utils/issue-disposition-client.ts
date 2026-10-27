import type {
  IssueDisposition,
  IssueReviewCategory,
} from '@/src/domain/issue-disposition';
import {
  SET_BULK_ISSUE_DISPOSITION,
  SET_ISSUE_DISPOSITION,
  type IssueDispositionMutationResponse,
} from '@/src/messaging/issue-disposition-types';
import { browser } from 'wxt/browser';

export const ISSUE_DISPOSITION_UPDATE_FAILED_MESSAGE =
  'Could not update the issue review disposition.';

function isIssueDispositionMutationResponse(
  value: unknown,
): value is IssueDispositionMutationResponse {
  if (typeof value !== 'object' || value === null || !('ok' in value)) {
    return false;
  }
  if ((value as { ok: boolean }).ok === true) {
    return true;
  }
  const error = (value as { error?: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

async function sendIssueDispositionMessage(
  message: Record<string, unknown>,
): Promise<IssueDispositionMutationResponse> {
  if (typeof browser === 'undefined') {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: ISSUE_DISPOSITION_UPDATE_FAILED_MESSAGE,
      },
    };
  }

  try {
    const response: unknown = await browser.runtime.sendMessage(message);
    if (!isIssueDispositionMutationResponse(response)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: ISSUE_DISPOSITION_UPDATE_FAILED_MESSAGE,
        },
      };
    }
    return response;
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: ISSUE_DISPOSITION_UPDATE_FAILED_MESSAGE,
      },
    };
  }
}

export const issueDispositionClient = {
  setIssueDisposition(input: {
    category: IssueReviewCategory;
    issueId: string;
    disposition: IssueDisposition;
  }): Promise<IssueDispositionMutationResponse> {
    return sendIssueDispositionMessage({
      type: SET_ISSUE_DISPOSITION,
      category: input.category,
      issueId: input.issueId,
      disposition: input.disposition,
    });
  },
  setBulkDisposition(input: {
    category: IssueReviewCategory | 'all';
    disposition: IssueDisposition;
  }): Promise<IssueDispositionMutationResponse> {
    return sendIssueDispositionMessage({
      type: SET_BULK_ISSUE_DISPOSITION,
      category: input.category,
      disposition: input.disposition,
    });
  },
};
