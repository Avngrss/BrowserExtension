import { rewriteOpaqueNavigationStep } from '@/src/actions/action-report-steps';
import type {
  PotentialBug,
  PotentialBugIssueCategory,
} from '@/src/domain/potential-bug';
import { formatActionTimelinePath } from '@/src/privacy/timeline-url';
import {
  writingLensContextLine,
  type BugTicketLens,
} from '@/src/prompt/bug-ticket-lens';

export const PROMPT_NOT_CAPTURED = 'Not captured';

export type PromptSignal = {
  category: PotentialBugIssueCategory;
  text: string;
  expected: boolean;
  evidenceLines: string[];
};

export function formatPromptUserFlow(bug: PotentialBug): string | null {
  const steps = bug.actions.map((action) =>
    rewriteOpaqueNavigationStep(action.step.trim(), bug.page.pathname),
  );
  if (steps.length === 0) {
    return null;
  }
  if (steps.length === 1) {
    return steps[0] ?? null;
  }
  if (steps.length <= 4) {
    return steps.join(' Then ');
  }
  const first = steps[0] ?? '';
  const last = steps[steps.length - 1] ?? first;
  return `${steps.length} captured steps, from “${first}” through “${last}”.`;
}

export function buildPromptDescriptionContext(
  bug: PotentialBug,
  lens: BugTicketLens,
  primaryText: string | null,
): string[] {
  const lines: string[] = [];
  const title = bug.page.title?.trim();
  const path = formatActionTimelinePath(bug.page.url);
  const where =
    title !== undefined && title.length > 0 ? `${title} (${path})` : path;
  lines.push(`- Where: ${where}`);

  const flow = formatPromptUserFlow(bug);
  if (flow !== null) {
    lines.push(`- Flow leading to the issue: ${flow}`);
  }

  const note = bug.note?.trim();
  if (note !== undefined && note.length > 0) {
    lines.push(`- Tester report: ${note}`);
  }

  if (primaryText !== null) {
    lines.push(`- Primary symptom: ${primaryText}`);
  }

  lines.push(writingLensContextLine(lens));
  lines.push(
    `- Capture type: ${bug.source === 'manual' ? 'manual' : 'automatic'}`,
  );

  return lines;
}

/** Primary defect fact for the ticket Actual result section. */
export function buildPromptActualResultFact(
  bug: PotentialBug,
  primaryText: string | null,
): string | null {
  if (primaryText !== null) {
    return primaryText;
  }

  const note = bug.note?.trim();
  if (note !== undefined && note.length > 0) {
    return note;
  }

  return null;
}
