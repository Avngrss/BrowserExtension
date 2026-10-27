import type { SessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';

export function canReviewIssuesInSession(
  session: SessionSnapshot,
): session is Extract<SessionSnapshot, { id: string }> {
  return isActiveSession(session);
}

export const NO_ACTIVE_SESSION_REVIEW_ERROR = {
  code: 'NO_ACTIVE_SESSION',
  message: 'Issue review is only available for the current session.',
} as const;
