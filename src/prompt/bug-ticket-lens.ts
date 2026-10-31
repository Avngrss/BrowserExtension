import type { PotentialBugIssueCategory } from '@/src/domain/potential-bug';

export type BugTicketLensKind =
  'ui' | 'console' | 'network' | 'mixed' | 'observation';

export type BugTicketLens = {
  kind: BugTicketLensKind;
  primaryCategory: PotentialBugIssueCategory | null;
};

const LENS_PRIORITY: PotentialBugIssueCategory[] = ['ui', 'console', 'network'];

const LENS_BULLETS: Record<BugTicketLensKind, string[]> = {
  ui: [
    '- The defect is the visible page message in Primary symptom / Actual result. Quote it in Title (short) and Actual Result.',
    '- Expected Result: this message or alert should not appear, unless Tester note states the correct behavior.',
    '- Labels include ui. Do not mention console or network in the Title.',
    '- Severity: visible error or alert → Major; cosmetic only → Minor or Trivial.',
  ],
  console: [
    '- The defect is the quoted console error in Primary symptom. Quote that error in Title and Actual Result.',
    '- Do not guess that end users or shoppers on the page are affected. Impact is the browser DevTools Console unless a UI message is also in evidence.',
    '- Expected Result: this console error should not occur.',
    '- Severity: Minor. Priority: Low or Medium.',
    '- Labels include console. Do not label this as a product outage or user-facing UI bug.',
  ],
  network: [
    '- The defect is the failed request in Primary symptom (method, path, and status or failure).',
    '- Actual Result: that request failure only. Do not list other requests, analytics, durations, or occurrence counts.',
    '- Expected Result: this request should succeed (or should not fail this way). Do not invent a response body.',
    '- Severity: HTTP 5xx → Major; HTTP 4xx, timeout, or abort → Major or Minor from the evidence only.',
    '- Labels include api or network.',
  ],
  mixed: [
    '- Primary symptom is the user-facing defect. Prefer UI over console over network.',
    '- Title and Actual Result follow Primary symptom only. Related signals are correlation — you may mention them in Description, never as a second Actual Result.',
    '- Labels may include more than one tag matching the evidence (ui, console, api).',
    '- Severity follows the primary symptom (visible UI error or HTTP 5xx → Major; console-only would be Minor).',
  ],
  observation: [
    '- No UI message, console error, or failed request is linked.',
    '- Describe only the captured flow and Tester note if present. Do not invent a failure, error message, or broken feature.',
    '- Title: a short factual statement of what was captured, not a guessed defect.',
    '- Actual Result: the captured flow or Tester note. Expected Result: use Tester note if it states what should happen; otherwise one neutral line that expected behavior was not specified.',
    '- Severity: Trivial or Minor. Priority: Low.',
  ],
};

type LensSignal = {
  category: PotentialBugIssueCategory;
  expected: boolean;
};

export function classifyBugTicketLens(signals: LensSignal[]): BugTicketLens {
  const present = new Set(
    signals
      .filter((signal) => !signal.expected)
      .map((signal) => signal.category),
  );
  const categories = LENS_PRIORITY.filter((category) => present.has(category));
  const primaryCategory = categories[0];
  if (primaryCategory === undefined) {
    return { kind: 'observation', primaryCategory: null };
  }
  if (categories.length === 1) {
    return { kind: primaryCategory, primaryCategory };
  }
  return { kind: 'mixed', primaryCategory };
}

export function primarySymptomText<T extends LensSignal & { text: string }>(
  signals: T[],
  lens: BugTicketLens,
): string | null {
  if (lens.primaryCategory === null) {
    return null;
  }
  const match = signals.find(
    (signal) => !signal.expected && signal.category === lens.primaryCategory,
  );
  return match?.text ?? null;
}

export function relatedPromptSignals<T extends LensSignal>(
  signals: T[],
  lens: BugTicketLens,
): T[] {
  return signals.filter((signal) => {
    if (signal.expected) {
      return true;
    }
    if (lens.primaryCategory === null) {
      return true;
    }
    return signal.category !== lens.primaryCategory;
  });
}

export function writingLensContextLine(lens: BugTicketLens): string {
  if (lens.kind === 'mixed' && lens.primaryCategory !== null) {
    return `- Writing lens: mixed (primary: ${lens.primaryCategory})`;
  }
  return `- Writing lens: ${lens.kind}`;
}

export function lensInstructionLines(lens: BugTicketLens): string[] {
  const heading =
    lens.kind === 'mixed' && lens.primaryCategory !== null
      ? `WRITING LENS (${lens.kind}, primary: ${lens.primaryCategory}):`
      : `WRITING LENS (${lens.kind}):`;
  return [heading, ...LENS_BULLETS[lens.kind]];
}
