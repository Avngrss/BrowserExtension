import type { IssueDisposition } from '@/src/domain/issue-disposition';
import type {
  PotentialBug,
  PotentialBugIssueRef,
} from '@/src/domain/potential-bug';
import type { PotentialBugIssueLookup } from '@/src/potential-bugs/potential-bug-description';
import {
  formatConsoleTechnicalEvidence,
  formatNetworkTechnicalEvidence,
} from '@/src/sidepanel/report-technical-evidence';
import { describeUiIssue } from '@/src/ui/ui-issue-descriptions';
import { PRODUCT_NAME } from '@/src/utils/product';

export const STEPS_FOR_BUG_TICKET_MODE_LABEL = 'Steps for bug ticket';

const NOT_CAPTURED = 'Not captured';

type ProblemLine = { text: string; expected: boolean };

function problemLine(
  issue: { disposition: IssueDisposition },
  text: string,
): ProblemLine | null {
  if (issue.disposition === 'excluded') {
    return null;
  }
  return { text, expected: issue.disposition === 'expected' };
}

function resolveProblem(
  ref: PotentialBugIssueRef,
  lookup: PotentialBugIssueLookup,
): ProblemLine | null {
  switch (ref.category) {
    case 'ui': {
      const issue = lookup.uiIssues.find((item) => item.id === ref.issueId);
      return issue === undefined
        ? null
        : problemLine(issue, describeUiIssue(issue));
    }
    case 'console': {
      const issue = lookup.consoleIssues.find(
        (item) => item.id === ref.issueId,
      );
      return issue === undefined
        ? null
        : problemLine(issue, formatConsoleTechnicalEvidence(issue));
    }
    case 'network': {
      const issue = lookup.networkIssues.find(
        (item) => item.id === ref.issueId,
      );
      return issue === undefined
        ? null
        : problemLine(issue, formatNetworkTechnicalEvidence(issue));
    }
  }
}

function instructions(hasExpectedProblems: boolean): string[] {
  return [
    'Write a bug ticket from the captured evidence below.',
    '',
    'Rules:',
    '- Use only the facts in "Captured evidence". Do not invent expected behavior, root cause, or details that are not listed.',
    `- If the evidence for a ticket section is missing, write "${NOT_CAPTURED}".`,
    '- Keep the steps in the given order. You may rephrase them for clarity, but do not add steps.',
    ...(hasExpectedProblems
      ? [
          '- Problems marked [Expected] were confirmed as expected behavior by the tester. Do not report them as defects.',
        ]
      : []),
    '',
    'Ticket format:',
    '- Title: one short factual line.',
    '- Steps to reproduce: numbered list.',
    '- Actual result: what was observed.',
    '- Expected result: use the tester note if it states one; otherwise write "To be confirmed by the tester".',
    '- Environment: page URL and detection time.',
    '- Evidence: technical details and screenshot count.',
  ];
}

export function buildStepsForBugTicketPrompt(
  bug: PotentialBug,
  lookup: PotentialBugIssueLookup,
  screenshotCount: number,
): string {
  const problems = bug.issues
    .map((ref) => resolveProblem(ref, lookup))
    .filter((line): line is ProblemLine => line !== null);
  const note = bug.note?.trim();
  const title = bug.page.title?.trim();

  return [
    ...instructions(problems.some((line) => line.expected)),
    '',
    'Captured evidence:',
    '',
    `Page URL: ${bug.page.url}`,
    ...(title !== undefined && title.length > 0
      ? [`Page title: ${title}`]
      : []),
    `Detected at: ${new Date(bug.createdAt).toISOString()}`,
    `Detection: ${
      bug.source === 'manual'
        ? 'Captured manually by the tester'
        : 'Detected automatically during capture'
    }`,
    '',
    'Tester note:',
    note !== undefined && note.length > 0 ? note : NOT_CAPTURED,
    '',
    'Steps (captured browser actions, oldest first):',
    ...(bug.actions.length > 0
      ? bug.actions.map((action, index) => `${index + 1}. ${action.step}`)
      : [NOT_CAPTURED]),
    '',
    'Observed problems:',
    ...(problems.length > 0
      ? problems.map(
          (line) => `- ${line.text}${line.expected ? ' [Expected]' : ''}`,
        )
      : [NOT_CAPTURED]),
    '',
    `Screenshots: ${screenshotCount} captured in ${PRODUCT_NAME} (not included in this text).`,
  ].join('\n');
}
