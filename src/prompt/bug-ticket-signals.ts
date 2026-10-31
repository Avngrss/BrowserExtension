import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { IssueDisposition } from '@/src/domain/issue-disposition';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type {
  PotentialBug,
  PotentialBugIssueCategory,
  PotentialBugIssueRef,
} from '@/src/domain/potential-bug';
import type { UiIssue } from '@/src/domain/ui-issue';
import type { PotentialBugIssueLookup } from '@/src/potential-bugs/potential-bug-description';
import {
  consoleIssueFactualDraft,
  networkIssueFactualDraft,
  uiIssueFactualDraft,
} from '@/src/bug-report/factual-what-happened-draft';
import { isReportableNetworkIssue } from '@/src/bug-report/reportable-network-issue';
import { formatActionTimelinePath } from '@/src/privacy/timeline-url';
import { truncateCapturedText } from '@/src/privacy/text-sanitizer';
import type { PromptSignal } from '@/src/prompt/prompt-description-context';

function quoted(value: string): string {
  const safe = truncateCapturedText(value) ?? value.trim();
  return `“${safe}”`;
}

function uiEvidenceLines(issue: UiIssue): string[] {
  const message = issue.visibleMessage?.trim();
  const lines =
    message !== undefined && message.length > 0
      ? [`Visible message: ${quoted(message)}`]
      : ['Visible message: not shown in capture'];
  const ruleName = issue.ruleName.trim();
  if (ruleName.length > 0) {
    lines.push(`Rule: ${ruleName}`);
  }
  return lines;
}

function consoleEvidenceLines(issue: ConsoleIssue): string[] {
  return [`Error: ${quoted(issue.message)}`, `Category: ${issue.category}`];
}

function networkEvidenceLines(issue: NetworkIssue): string[] {
  const path = formatActionTimelinePath(issue.url);
  const lines = [`Request: ${issue.method} ${path}`];
  if (issue.status !== undefined) {
    lines.push(`Status: HTTP ${issue.status}`);
    return lines;
  }
  const failure = issue.failureMessage?.trim();
  if (failure !== undefined && failure.length > 0) {
    lines.push(`Failure: ${quoted(failure)}`);
    return lines;
  }
  if (issue.category === 'timeout') {
    lines.push('Outcome: timed out');
    return lines;
  }
  if (issue.category === 'aborted') {
    lines.push('Outcome: aborted');
    return lines;
  }
  lines.push('Outcome: failed');
  return lines;
}

function problemLine(
  issue: { disposition: IssueDisposition },
  category: PotentialBugIssueCategory,
  text: string,
  evidenceLines: string[],
): PromptSignal | null {
  if (issue.disposition === 'excluded') {
    return null;
  }
  return {
    category,
    text,
    expected: issue.disposition === 'expected',
    evidenceLines,
  };
}

function resolveSignal(
  ref: PotentialBugIssueRef,
  lookup: PotentialBugIssueLookup,
): PromptSignal | null {
  switch (ref.category) {
    case 'ui': {
      const issue = lookup.uiIssues.find((item) => item.id === ref.issueId);
      return issue === undefined
        ? null
        : problemLine(
            issue,
            'ui',
            uiIssueFactualDraft(issue),
            uiEvidenceLines(issue),
          );
    }
    case 'console': {
      const issue = lookup.consoleIssues.find(
        (item) => item.id === ref.issueId,
      );
      return issue === undefined
        ? null
        : problemLine(
            issue,
            'console',
            consoleIssueFactualDraft(issue),
            consoleEvidenceLines(issue),
          );
    }
    case 'network': {
      const issue = lookup.networkIssues.find(
        (item) => item.id === ref.issueId,
      );
      if (issue === undefined || !isReportableNetworkIssue(issue)) {
        return null;
      }
      return problemLine(
        issue,
        'network',
        networkIssueFactualDraft(issue),
        networkEvidenceLines(issue),
      );
    }
  }
}

export function resolveBugTicketSignals(
  bug: PotentialBug,
  lookup: PotentialBugIssueLookup,
): PromptSignal[] {
  return bug.issues
    .map((ref) => resolveSignal(ref, lookup))
    .filter((line): line is PromptSignal => line !== null);
}
