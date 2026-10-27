import type { ScreenshotIssueCategory } from '@/src/domain/screenshot-evidence';

export type NewUniqueIssueEvent = {
  issueCategory: ScreenshotIssueCategory;
  issueId: string;
};

export type NewUniqueIssueNotifier = (event: NewUniqueIssueEvent) => void;
