import {
  consoleIssueFactualDraft,
  networkIssueFactualDraft,
  uiIssueFactualDraft,
} from '@/src/bug-report/factual-what-happened-draft';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type {
  PotentialBug,
  PotentialBugIssueCategory,
  PotentialBugIssueRef,
} from '@/src/domain/potential-bug';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import type { UiIssue } from '@/src/domain/ui-issue';
import { isReportableNetworkIssue } from '@/src/bug-report/reportable-network-issue';

export type PotentialBugIssueLookup = {
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
};

function issueRef(
  bug: PotentialBug,
  category: PotentialBugIssueCategory,
): PotentialBugIssueRef | undefined {
  return bug.issues.find((issue) => issue.category === category);
}

function factualDraftForRef(
  ref: PotentialBugIssueRef,
  lookup: PotentialBugIssueLookup,
): string | null {
  switch (ref.category) {
    case 'ui': {
      const issue = lookup.uiIssues.find((item) => item.id === ref.issueId);
      if (
        issue === undefined ||
        issue.disposition === 'excluded' ||
        issue.disposition === 'expected'
      ) {
        return null;
      }
      return uiIssueFactualDraft(issue);
    }
    case 'console': {
      const issue = lookup.consoleIssues.find(
        (item) => item.id === ref.issueId,
      );
      if (
        issue === undefined ||
        issue.disposition === 'excluded' ||
        issue.disposition === 'expected'
      ) {
        return null;
      }
      return consoleIssueFactualDraft(issue);
    }
    case 'network': {
      const issue = lookup.networkIssues.find(
        (item) => item.id === ref.issueId,
      );
      if (
        issue === undefined ||
        issue.disposition === 'excluded' ||
        issue.disposition === 'expected' ||
        !isReportableNetworkIssue(issue)
      ) {
        return null;
      }
      return networkIssueFactualDraft(issue);
    }
  }
}

export function potentialBugTitle(bug: PotentialBug, index: number): string {
  return bug.source === 'manual' ? 'Captured manually' : `Bug ${index + 1}`;
}

export function buildPotentialBugDescription(
  bug: PotentialBug,
  lookup: PotentialBugIssueLookup,
): string {
  const note = bug.note?.trim();
  if (note !== undefined && note.length > 0) {
    return note;
  }

  for (const category of ['ui', 'console', 'network'] as const) {
    const ref = issueRef(bug, category);
    if (ref === undefined) {
      continue;
    }
    const draft = factualDraftForRef(ref, lookup);
    if (draft !== null) {
      return draft;
    }
  }

  return bug.source === 'manual'
    ? `Captured manually on ${bug.page.pathname}.`
    : `Potential bug detected on ${bug.page.pathname}.`;
}

function isScreenshotLinkedToBug(
  bug: PotentialBug,
  item: ScreenshotEvidence,
): boolean {
  if (item.sessionId !== bug.sessionId) {
    return false;
  }
  if (item.issueCategory === 'mark') {
    return item.issueId === bug.id;
  }
  return bug.issues.some(
    (issue) =>
      issue.category === item.issueCategory && issue.issueId === item.issueId,
  );
}

export function selectPotentialBugScreenshots(
  bug: PotentialBug,
  evidence: ScreenshotEvidence[],
): ScreenshotEvidence[] {
  const frames = new Set<string>();
  const selected: ScreenshotEvidence[] = [];
  for (const item of evidence) {
    if (item.status !== 'captured' || !isScreenshotLinkedToBug(bug, item)) {
      continue;
    }
    if (frames.has(item.frameId)) {
      continue;
    }
    frames.add(item.frameId);
    selected.push(item);
  }
  return selected;
}

export function countPotentialBugScreenshots(
  bug: PotentialBug,
  evidence: ScreenshotEvidence[],
): number {
  const frames = new Set<string>();
  for (const item of evidence) {
    if (item.status === 'failed' || item.status === 'unavailable') {
      continue;
    }
    if (!isScreenshotLinkedToBug(bug, item)) {
      continue;
    }
    frames.add(item.frameId);
  }
  return frames.size;
}
