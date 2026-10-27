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
} from '@/src/domain/potential-bug';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import type { UiIssue } from '@/src/domain/ui-issue';

export type PotentialBugIssueLookup = {
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
};

function firstIssueId(
  bug: PotentialBug,
  category: PotentialBugIssueCategory,
): string | undefined {
  return bug.issues.find((issue) => issue.category === category)?.issueId;
}

export function buildPotentialBugDescription(
  bug: PotentialBug,
  lookup: PotentialBugIssueLookup,
): string {
  const note = bug.note?.trim();
  if (note !== undefined && note.length > 0) {
    return note;
  }

  const uiId = firstIssueId(bug, 'ui');
  const ui = lookup.uiIssues.find((issue) => issue.id === uiId);
  if (ui !== undefined) {
    return uiIssueFactualDraft(ui);
  }

  const consoleId = firstIssueId(bug, 'console');
  const consoleIssue = lookup.consoleIssues.find(
    (issue) => issue.id === consoleId,
  );
  if (consoleIssue !== undefined) {
    return consoleIssueFactualDraft(consoleIssue);
  }

  const networkId = firstIssueId(bug, 'network');
  const networkIssue = lookup.networkIssues.find(
    (issue) => issue.id === networkId,
  );
  if (networkIssue !== undefined) {
    return networkIssueFactualDraft(networkIssue);
  }

  return bug.source === 'manual'
    ? `Captured manually on ${bug.page.pathname}.`
    : `Potential bug detected on ${bug.page.pathname}.`;
}

export function countPotentialBugScreenshots(
  bug: PotentialBug,
  evidence: ScreenshotEvidence[],
): number {
  const frames = new Set<string>();
  for (const item of evidence) {
    if (item.sessionId !== bug.sessionId) {
      continue;
    }
    if (item.status === 'failed' || item.status === 'unavailable') {
      continue;
    }
    const linked =
      item.issueCategory === 'mark'
        ? item.issueId === bug.id
        : bug.issues.some(
            (issue) =>
              issue.category === item.issueCategory &&
              issue.issueId === item.issueId,
          );
    if (linked) {
      frames.add(item.frameId);
    }
  }
  return frames.size;
}
