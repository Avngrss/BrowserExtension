import { rewriteOpaqueNavigationStep } from '@/src/actions/action-report-steps';
import type {
  PotentialBug,
  PotentialBugIssueCategory,
} from '@/src/domain/potential-bug';
import type { PotentialBugIssueLookup } from '@/src/potential-bugs/potential-bug-description';
import {
  formatActionTimelinePath,
  formatTicketEnvironmentUrl,
} from '@/src/privacy/timeline-url';
import {
  classifyBugTicketLens,
  primarySymptomText,
  relatedPromptSignals,
  type BugTicketLens,
} from '@/src/prompt/bug-ticket-lens';
import { resolveBugTicketSignals } from '@/src/prompt/bug-ticket-signals';
import { buildPromptActualResultFact } from '@/src/prompt/prompt-description-context';

export type BugTicketSeverity = 'Critical' | 'Major' | 'Minor' | 'Trivial';
export type BugTicketPriority = 'High' | 'Medium' | 'Low';

export type BugTicketDraft = {
  title: string;
  description: string;
  steps: string[];
  actualResult: string;
  expectedResult: string;
  severity: BugTicketSeverity;
  priority: BugTicketPriority;
  labels: string[];
  environment: string;
};

const FEATURE_FROM_PATH: [RegExp, string][] = [
  [/checkout|payment|\bpay\b/, 'Checkout'],
  [/cart|basket/, 'Cart'],
  [/login|signin|auth/, 'Auth'],
  [/signup|register/, 'Signup'],
  [/contact/, 'Contact'],
  [/product/, 'Product'],
  [/search/, 'Search'],
  [/account|profile/, 'Account'],
];

function ensurePeriod(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function truncateTitle(text: string, max = 56): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}

function detectFeature(bug: PotentialBug, lens: BugTicketLens): string {
  const path = bug.page.pathname.toLowerCase();
  for (const [pattern, name] of FEATURE_FROM_PATH) {
    if (pattern.test(path)) {
      return name;
    }
  }
  const title = bug.page.title?.trim();
  if (title !== undefined && title.length > 0 && title.length <= 40) {
    const cleaned = title.replace(/\s*[|\-–].*$/, '').trim();
    if (cleaned.length > 0 && cleaned.length <= 24) {
      return cleaned;
    }
  }
  const segment = path
    .split('/')
    .filter((part) => part.length > 0)
    .pop();
  if (segment !== undefined && segment.length <= 20 && !/^\d+$/.test(segment)) {
    return `${segment.charAt(0)?.toUpperCase() ?? ''}${segment.slice(1)}`;
  }
  switch (lens.kind) {
    case 'console':
      return 'Console';
    case 'network':
      return 'API';
    case 'ui':
      return 'UI';
    default:
      return 'Page';
  }
}

function shortProblem(
  primaryText: string | null,
  bug: PotentialBug,
  note: string | undefined,
): string {
  if (primaryText === null) {
    if (note !== undefined && note.length > 0) {
      return truncateTitle(note.replace(/\s+/g, ' '));
    }
    return `Issue on ${formatActionTimelinePath(bug.page.url)}`;
  }
  const quoted = primaryText.match(/“([^”]+)”/);
  if (quoted?.[1] !== undefined) {
    return truncateTitle(quoted[1]);
  }
  const http = primaryText.match(/fails with HTTP (\d+)/);
  if (http?.[1] !== undefined) {
    const pathMatch = primaryText.match(/to (\S+)/);
    if (pathMatch?.[1] !== undefined) {
      return `${pathMatch[1]} fails with HTTP ${http[1]}`;
    }
    return `Request fails with HTTP ${http[1]}`;
  }
  return truncateTitle(primaryText.replace(/^The\s+/i, '').replace(/\.$/, ''));
}

function compactPageTitle(title: string): string {
  const trimmed = title.trim();
  const cut = trimmed.split(/\s+[-–—|]\s+/)[0]?.trim();
  if (cut !== undefined && cut.length >= 3 && cut.length < trimmed.length) {
    return cut;
  }
  if (trimmed.length > 72) {
    return `${trimmed.slice(0, 71)}…`;
  }
  return trimmed;
}

function whereLabel(bug: PotentialBug): string {
  const title = bug.page.title?.trim();
  if (title !== undefined && title.length > 0) {
    return compactPageTitle(title);
  }
  return formatTicketEnvironmentUrl(bug.page.url);
}

const ANALYTICS_NOISE =
  /\/g\/collect\b|google-analytics\.com|googletagmanager\.com|\/gtm\.js\b|doubleclick\.net/i;

function isAnalyticsNoise(text: string): boolean {
  return ANALYTICS_NOISE.test(text);
}

function ticketSteps(bug: PotentialBug): string[] {
  return bug.actions.map((action) =>
    rewriteOpaqueNavigationStep(action.step, bug.page.pathname),
  );
}

function findLinkedIssue<T extends { id: string }>(
  bug: PotentialBug,
  category: PotentialBugIssueCategory,
  issues: T[],
): T | undefined {
  const ref = bug.issues.find((issue) => issue.category === category);
  if (ref === undefined) {
    return undefined;
  }
  return issues.find((issue) => issue.id === ref.issueId);
}

function symptomParagraph(
  where: string,
  primaryText: string | null,
  note: string | undefined,
): string {
  if (primaryText !== null) {
    return `On ${where}. ${ensurePeriod(primaryText)}`;
  }
  if (note !== undefined && note.length > 0) {
    return `On ${where}. ${ensurePeriod(note)}`;
  }
  return `On ${where}. No UI message, console error, or failed request is linked.`;
}

function contextLines(
  bug: PotentialBug,
  lookup: PotentialBugIssueLookup,
  lens: BugTicketLens,
): string[] {
  const lines: string[] = [];
  if (lens.primaryCategory === 'ui') {
    const issue = findLinkedIssue(bug, 'ui', lookup.uiIssues);
    if (issue !== undefined) {
      if (issue.element.role === 'alert' || /alert/i.test(issue.ruleName)) {
        lines.push('Shown as a page alert.');
      } else if (issue.ruleName === 'Invalid field') {
        lines.push('Shown on a field marked invalid.');
      }
      if (issue.occurrenceCount > 1) {
        lines.push(`Seen ${issue.occurrenceCount} times in this session.`);
      }
    }
  }
  if (lens.kind === 'console' || lens.primaryCategory === 'console') {
    const issue = findLinkedIssue(bug, 'console', lookup.consoleIssues);
    lines.push('Recorded from the DevTools Console.');
    if (issue?.category === 'uncaught-error') {
      lines.push('It is an uncaught page error.');
    } else if (issue?.category === 'unhandled-rejection') {
      lines.push('It is an unhandled promise rejection.');
    }
    if (issue !== undefined && issue.occurrenceCount > 1) {
      lines.push(`Seen ${issue.occurrenceCount} times in this session.`);
    }
  }
  return lines;
}

function buildDescription(
  bug: PotentialBug,
  lookup: PotentialBugIssueLookup,
  lens: BugTicketLens,
  primaryText: string | null,
  relatedTexts: string[],
  note: string | undefined,
): string {
  const paragraphs = [symptomParagraph(whereLabel(bug), primaryText, note)];
  const steps = ticketSteps(bug);
  if (steps.length > 0) {
    paragraphs.push(`Before that: ${steps.join(' ')}`);
  }
  const context = contextLines(bug, lookup, lens);
  if (context.length > 0) {
    paragraphs.push(context.join(' '));
  }
  const related = relatedTexts.filter(
    (text) => lens.primaryCategory === 'network' || !isAnalyticsNoise(text),
  );
  if (lens.kind === 'mixed' && related.length > 0) {
    paragraphs.push(
      `Also captured: ${related.map((text) => ensurePeriod(text)).join(' ')}`,
    );
  }
  return paragraphs.join('\n\n');
}

function expectedResult(
  note: string | undefined,
  primaryText: string | null,
  lens: BugTicketLens,
): string {
  if (note !== undefined && note.length > 0) {
    const expectedPart = note.match(/expected:\s*(.+)/i);
    if (expectedPart?.[1] !== undefined) {
      return ensurePeriod(expectedPart[1]);
    }
    if (/\b(should|must|expected)\b/i.test(note)) {
      return ensurePeriod(note);
    }
  }
  if (lens.kind === 'observation' || primaryText === null) {
    return 'Expected behavior was not specified.';
  }
  if (primaryText.includes('page shows')) {
    return 'This message should not appear.';
  }
  if (primaryText.includes('console shows')) {
    return 'This console error should not occur.';
  }
  if (primaryText.includes('request')) {
    return 'This request should succeed.';
  }
  return 'This error should not occur.';
}

function pickSeverity(
  lens: BugTicketLens,
  primaryText: string | null,
  hasNote: boolean,
): BugTicketSeverity {
  if (lens.kind === 'observation') {
    return hasNote ? 'Minor' : 'Trivial';
  }
  if (lens.kind === 'console' || lens.primaryCategory === 'console') {
    return 'Minor';
  }
  if (lens.kind === 'network' || lens.primaryCategory === 'network') {
    if (
      primaryText !== null &&
      (primaryText.includes('HTTP 5') ||
        primaryText.includes('fails:') ||
        primaryText.includes('times out'))
    ) {
      return 'Major';
    }
    return 'Minor';
  }
  return 'Major';
}

function pickPriority(
  severity: BugTicketSeverity,
  lens: BugTicketLens,
): BugTicketPriority {
  if (severity === 'Critical' || severity === 'Major') {
    return 'High';
  }
  if (severity === 'Trivial' || lens.kind === 'console') {
    return 'Low';
  }
  return 'Medium';
}

function pickLabels(
  defectCategories: PotentialBugIssueCategory[],
  feature: string,
  note: string | undefined,
): string[] {
  const labels: string[] = [];
  const featureTag = feature.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if (defectCategories.includes('ui')) {
    labels.push('ui');
  }
  if (defectCategories.includes('console')) {
    labels.push('console');
  }
  if (defectCategories.includes('network')) {
    labels.push('api');
  }
  if (featureTag.length > 0 && !labels.includes(featureTag)) {
    labels.push(featureTag);
  }
  if (
    note !== undefined &&
    /used to work|after (the )?update|regression/i.test(note)
  ) {
    labels.push('regression');
  }
  return labels.slice(0, 4);
}

export function buildBugTicketDraft(
  bug: PotentialBug,
  lookup: PotentialBugIssueLookup,
): BugTicketDraft {
  const signals = resolveBugTicketSignals(bug, lookup);
  const lens = classifyBugTicketLens(signals);
  const primaryText = primarySymptomText(signals, lens);
  const related = relatedPromptSignals(signals, lens)
    .filter((signal) => !signal.expected)
    .map((signal) => signal.text);
  const note = bug.note?.trim();
  const feature = detectFeature(bug, lens);
  const actualResult =
    buildPromptActualResultFact(bug, primaryText) ??
    'No UI message, console error, or failed request is linked.';
  const severity = pickSeverity(
    lens,
    primaryText,
    note !== undefined && note.length > 0,
  );
  const steps = ticketSteps(bug);

  return {
    title: `[${feature}] ${shortProblem(primaryText, bug, note)}`,
    description: buildDescription(
      bug,
      lookup,
      lens,
      primaryText,
      related,
      note,
    ),
    steps: steps.length > 0 ? steps : ['The path was not recorded.'],
    actualResult,
    expectedResult: expectedResult(note, primaryText, lens),
    severity,
    priority: pickPriority(severity, lens),
    labels: pickLabels(
      signals
        .filter((signal) => !signal.expected)
        .map((signal) => signal.category)
        .filter((category, index, all) => all.indexOf(category) === index),
      feature,
      note,
    ),
    environment: formatTicketEnvironmentUrl(bug.page.url),
  };
}

export function formatBugTicketDraft(draft: BugTicketDraft): string {
  const steps = draft.steps
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n');
  return [
    '## Title',
    draft.title,
    '',
    '## Description',
    draft.description,
    '',
    '## Steps to Reproduce',
    steps,
    '',
    '## Actual Result',
    draft.actualResult,
    '',
    '## Expected Result',
    draft.expectedResult,
    '',
    '## Severity',
    draft.severity,
    '',
    '## Priority',
    draft.priority,
    '',
    '## Labels',
    draft.labels.join(', '),
    '',
    '## Environment',
    draft.environment,
  ].join('\n');
}
