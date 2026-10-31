import { rewriteOpaqueNavigationStep } from '@/src/actions/action-report-steps';
import type {
  PotentialBug,
  PotentialBugIssueCategory,
} from '@/src/domain/potential-bug';
import type { PotentialBugIssueLookup } from '@/src/potential-bugs/potential-bug-description';
import { formatTicketEnvironmentUrl } from '@/src/privacy/timeline-url';
import {
  classifyBugTicketLens,
  lensInstructionLines,
  primarySymptomText,
  relatedPromptSignals,
  type BugTicketLens,
} from '@/src/prompt/bug-ticket-lens';
import { resolveBugTicketSignals } from '@/src/prompt/bug-ticket-signals';
import {
  buildPromptActualResultFact,
  buildPromptDescriptionContext,
  PROMPT_NOT_CAPTURED,
  type PromptSignal,
} from '@/src/prompt/prompt-description-context';

export const STEPS_FOR_BUG_TICKET_MODE_LABEL = 'Bug ticket';

const NOT_CAPTURED = PROMPT_NOT_CAPTURED;

const RELATED_SIGNALS_HEADING =
  'Related signals (correlation only; do not use as Title or Actual Result):';

function instructions(input: {
  lens: BugTicketLens;
  hasExpectedProblems: boolean;
}): string[] {
  return [
    'You are a Senior QA Engineer.',
    '',
    'Your task is to convert the captured evidence below into a high-quality bug report in English.',
    '',
    'CORE RULES:',
    '- Always write the ticket in English.',
    '- Be concise but natural. Sound like an experienced QA writing a real ticket, not a template and not a review of the evidence.',
    '- Use only the facts in Captured evidence. Do not invent root cause, extra steps, extra UI, or impact the evidence does not state.',
    '- If a detail is missing, use short neutral wording. Never write "Not captured" in Title, Description, or Actual Result. Never write that the ticket or the evidence "lacks" information.',
    '- Write in present tense (e.g. "The page shows…", "The console displays…").',
    '',
    'STYLE:',
    '- Title MUST be short and clear. Format: [Feature] Short problem statement. Avoid long, overloaded titles. Move extra context into Description.',
    '- Detect the feature from the page, flow, and signals (Product, Cart, Checkout, Auth, UI, API, Console, etc.).',
    '- Description MUST contain: context (where), what the user tried (from the steps), and details that do not belong in the Title. 2–4 natural sentences. Prefer simple wording. Do not restate the Title as one shortened sentence.',
    '',
    ...lensInstructionLines(input.lens),
    '',
    'STRUCTURE:',
    '- Title',
    '- Description',
    '- Steps to Reproduce — captured steps only, same order; you may rephrase for clarity; do not add steps. If the steps list is missing, one short neutral sentence that the path was not recorded.',
    '- Actual Result — Primary symptom (or Actual result from capture). Quote it. Do not write a vague line such as "shows an issue". Do not promote Related signals into Actual Result.',
    '- Expected Result — if Tester note states what should happen, use that. Otherwise one conservative line of correct behavior implied by the primary symptom only (this error, message, or failed request should not occur). Do not invent specific success copy or a business rule.',
    '- Severity — one of Critical, Major, Minor, Trivial. Follow the Writing lens.',
    '- Priority — High, Medium, or Low, consistent with Severity.',
    '- Labels — 2–4 tags. Follow the Writing lens. Add regression only if the evidence says it used to work.',
    '- Environment — page URL only.',
    '',
    'OUTPUT FORMAT (STRICT):',
    '- Markdown only, sections in the order above.',
    '- No extra comments outside the report.',
    '- Do not add an Evidence section. Do not list HTTP durations, occurrence counts, or analytics/background requests unless they are the main failure.',
    ...(input.hasExpectedProblems
      ? [
          '- Signals marked [Expected] were confirmed as expected by the tester. Do not report them as defects.',
        ]
      : []),
  ];
}

function extraInstructionsBlock(extraInstructions: string): string[] {
  const trimmed = extraInstructions.trim();
  if (trimmed.length === 0) {
    return [];
  }
  return [
    'Additional team instructions from Settings (follow these unless they invent facts or root cause):',
    trimmed,
    '',
  ];
}

function bulletLines(lines: string[]): string[] {
  return lines.map((line) => `- ${line}`);
}

function typedEvidenceBlocks(
  signals: PromptSignal[],
  screenshotCount: number,
): string[] {
  const defect = signals.filter((signal) => !signal.expected);
  const blocks: string[] = [];

  const appendCategory = (
    heading: string,
    category: PotentialBugIssueCategory,
    extraLines: string[] = [],
  ): void => {
    const items = defect.filter((signal) => signal.category === category);
    if (items.length === 0) {
      return;
    }
    blocks.push('', heading);
    for (const item of items) {
      blocks.push(...bulletLines(item.evidenceLines));
    }
    blocks.push(...bulletLines(extraLines));
  };

  const uiScreenshot =
    screenshotCount > 0 && defect.some((signal) => signal.category === 'ui')
      ? [
          `Screenshots: ${screenshotCount} captured in the extension (not embedded here)`,
        ]
      : [];

  appendCategory('UI evidence:', 'ui', uiScreenshot);
  appendCategory('Console evidence:', 'console');
  appendCategory('Network evidence:', 'network');
  return blocks;
}

function screenshotHint(
  screenshotCount: number,
  signals: PromptSignal[],
): string | null {
  if (screenshotCount <= 0) {
    return null;
  }
  const hasUiDefect = signals.some(
    (signal) => signal.category === 'ui' && !signal.expected,
  );
  if (hasUiDefect) {
    return null;
  }
  return `${screenshotCount} screenshot(s) captured in the extension (not embedded here). Mention in Description only if it helps explain what the user sees.`;
}

export function buildStepsForBugTicketPrompt(
  bug: PotentialBug,
  lookup: PotentialBugIssueLookup,
  screenshotCount: number,
  extraInstructions = '',
): string {
  const signals = resolveBugTicketSignals(bug, lookup);
  const lens = classifyBugTicketLens(signals);
  const primaryText = primarySymptomText(signals, lens);
  const related = relatedPromptSignals(signals, lens);
  const note = bug.note?.trim();
  const title = bug.page.title?.trim();
  const descriptionContext = buildPromptDescriptionContext(
    bug,
    lens,
    primaryText,
  );
  const actualResultFact = buildPromptActualResultFact(bug, primaryText);
  const trailingScreenshot = screenshotHint(screenshotCount, signals);

  return [
    ...extraInstructionsBlock(extraInstructions),
    ...instructions({
      lens,
      hasExpectedProblems: signals.some((line) => line.expected),
    }),
    '',
    'Captured evidence:',
    '',
    'Context:',
    ...descriptionContext,
    '',
    `Page URL: ${formatTicketEnvironmentUrl(bug.page.url)}`,
    ...(title !== undefined && title.length > 0
      ? [`Page title: ${title}`]
      : []),
    '',
    'Tester note (use for Expected Result when it describes correct behavior):',
    note !== undefined && note.length > 0 ? note : NOT_CAPTURED,
    '',
    'Steps to reproduce (oldest first):',
    ...(bug.actions.length > 0
      ? bug.actions.map(
          (action, index) =>
            `${index + 1}. ${rewriteOpaqueNavigationStep(action.step, bug.page.pathname)}`,
        )
      : [NOT_CAPTURED]),
    '',
    'Actual result (from capture):',
    actualResultFact ??
      'No UI message, console error, or failed request is linked. Describe only the captured flow; do not invent a failure.',
    ...typedEvidenceBlocks(signals, screenshotCount),
    '',
    RELATED_SIGNALS_HEADING,
    ...(related.length > 0
      ? related.map(
          (line) => `- ${line.text}${line.expected ? ' [Expected]' : ''}`,
        )
      : [NOT_CAPTURED]),
    ...(trailingScreenshot !== null ? ['', trailingScreenshot] : []),
  ].join('\n');
}
