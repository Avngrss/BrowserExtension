import type { SessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';

export type IssueCountSnapshot = {
  ui: number;
  console: number;
  network: number;
};

export type CaptureActionBadgeState = {
  badgeText: string;
  title: string;
};

export function countUniqueSessionIssues(input: IssueCountSnapshot): number {
  return input.ui + input.console + input.network;
}

export function resolveCaptureActionBadge(
  session: SessionSnapshot,
  issueCounts: IssueCountSnapshot,
): CaptureActionBadgeState {
  if (!isActiveSession(session)) {
    return {
      badgeText: '',
      title: 'Bug Capture Assistant — not capturing',
    };
  }

  if (session.status === 'stopped') {
    return {
      badgeText: '',
      title: 'Bug Capture Assistant — reviewing session',
    };
  }

  const uniqueIssues = countUniqueSessionIssues(issueCounts);
  if (uniqueIssues > 0) {
    const badgeText = uniqueIssues > 99 ? '99+' : String(uniqueIssues);
    return {
      badgeText,
      title: `${uniqueIssues} potential ${uniqueIssues === 1 ? 'issue' : 'issues'} detected while capturing`,
    };
  }

  if (session.status === 'paused') {
    return {
      badgeText: 'II',
      title: 'Bug Capture Assistant — capture paused',
    };
  }

  return {
    badgeText: 'REC',
    title: 'Bug Capture Assistant — recording capture',
  };
}
