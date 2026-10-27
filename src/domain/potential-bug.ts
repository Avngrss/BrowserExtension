export const POTENTIAL_BUG_GROUPING_WINDOW_MS = 3_000;
export const POTENTIAL_BUG_MAX_ACTIONS = 5;

export type PotentialBugIssueCategory = 'ui' | 'console' | 'network';

export type PotentialBugIssueRef = {
  category: PotentialBugIssueCategory;
  issueId: string;
};

export type PotentialBugStatus = 'included' | 'excluded';

export type PotentialBugSource = 'automatic' | 'manual';

export type PotentialBugPage = {
  url: string;
  pathname: string;
  title?: string;
};

export type PotentialBugAction = {
  actionId: string;
  step: string;
};

export type PotentialBug = {
  id: string;
  sessionId: string;
  createdAt: number;
  lastDetectedAt: number;
  source: PotentialBugSource;
  page: PotentialBugPage;
  actions: PotentialBugAction[];
  issues: PotentialBugIssueRef[];
  status: PotentialBugStatus;
  note?: string;
};

export function potentialBugPageKey(page: PotentialBugPage): string {
  try {
    const url = new URL(page.url);
    return `${url.origin}${url.pathname}`;
  } catch {
    return page.pathname;
  }
}
