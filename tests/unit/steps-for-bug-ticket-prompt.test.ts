import { describe, expect, it } from 'vitest';
import { buildStepsForBugTicketPrompt } from '@/src/prompt/steps-for-bug-ticket-prompt';
import {
  consoleIssue,
  networkIssue,
  potentialBug,
  uiIssue,
} from '../helpers/potential-bug-fixtures';

function evidenceSection(prompt: string): string {
  const [, evidence] = prompt.split('Captured evidence:\n\n');
  return evidence ?? '';
}

describe('buildStepsForBugTicketPrompt', () => {
  it('uses a mixed UI lens and typed evidence for an automatic cluster', () => {
    const prompt = buildStepsForBugTicketPrompt(
      potentialBug('bug-1', {
        page: {
          url: 'https://shop.test/checkout',
          pathname: '/checkout',
          title: 'Checkout',
        },
        actions: [
          { actionId: 'a1', step: 'Opened /checkout.' },
          { actionId: 'a2', step: 'Clicked “Pay”.' },
        ],
        issues: [
          { category: 'ui', issueId: 'u1' },
          { category: 'console', issueId: 'c1' },
          { category: 'network', issueId: 'n1' },
        ],
      }),
      {
        uiIssues: [uiIssue('u1')],
        consoleIssues: [consoleIssue('c1', { occurrenceCount: 3 })],
        networkIssues: [networkIssue('n1', { durationMs: 120, status: 500 })],
      },
      2,
    );

    expect(prompt).toContain('You are a Senior QA Engineer.');
    expect(prompt).toContain('high-quality bug report in English');
    expect(prompt).toContain('[Feature] Short problem statement');
    expect(prompt).toContain('2–4 natural sentences');
    expect(prompt).toContain('present tense');
    expect(prompt).toContain('WRITING LENS (mixed, primary: ui):');
    expect(prompt).toContain(
      'Title and Actual Result follow Primary symptom only.',
    );
    expect(prompt).toContain('Severity');
    expect(prompt).toContain('Priority');
    expect(prompt).toContain('Labels');
    expect(prompt).not.toContain('To be confirmed by the tester');
    expect(prompt).not.toContain('- Evidence:');
    expect(prompt).not.toContain('[Expected]');
    expect(prompt).not.toContain('shoppers');
    expect(evidenceSection(prompt)).toContain('Context:');
    expect(evidenceSection(prompt)).toContain(
      '- Primary symptom: The page shows “Payment unavailable”.',
    );
    expect(evidenceSection(prompt)).toContain(
      '- Writing lens: mixed (primary: ui)',
    );
    expect(evidenceSection(prompt)).toContain(
      'Page URL: https://shop.test/checkout',
    );
    expect(evidenceSection(prompt)).toContain('UI evidence:');
    expect(evidenceSection(prompt)).toContain(
      '- Visible message: “Payment unavailable”',
    );
    expect(evidenceSection(prompt)).toContain(
      '- Screenshots: 2 captured in the extension (not embedded here)',
    );
    expect(evidenceSection(prompt)).toContain('Console evidence:');
    expect(evidenceSection(prompt)).toContain('- Error: “Boom”');
    expect(evidenceSection(prompt)).toContain('Network evidence:');
    expect(evidenceSection(prompt)).toContain('- Request: POST /api/pay');
    expect(evidenceSection(prompt)).toContain('- Status: HTTP 500');
    expect(evidenceSection(prompt)).toContain(
      'Related signals (correlation only; do not use as Title or Actual Result):',
    );
    expect(evidenceSection(prompt)).toContain(
      '- The browser console shows an error: “Boom”.',
    );
    expect(evidenceSection(prompt)).not.toContain(
      'Related signals (correlation only; do not use as Title or Actual Result):\n- The page shows “Payment unavailable”.',
    );
    expect(evidenceSection(prompt)).not.toContain('occurrenceCount');
    expect(evidenceSection(prompt)).not.toContain('120');
  });

  it('uses a console lens, omits analytics, and keeps the tester note', () => {
    const prompt = buildStepsForBugTicketPrompt(
      potentialBug('bug-2', {
        source: 'manual',
        note: '  Wrong total  ',
        issues: [
          { category: 'console', issueId: 'c1' },
          { category: 'network', issueId: 'n1' },
        ],
      }),
      {
        uiIssues: [],
        consoleIssues: [consoleIssue('c1')],
        networkIssues: [
          networkIssue('n1', {
            url: 'https://shop.test/g/collect',
            status: 200,
          }),
        ],
      },
      0,
    );
    const evidence = evidenceSection(prompt);

    expect(prompt).toContain('WRITING LENS (console):');
    expect(prompt).toContain('browser DevTools Console');
    expect(evidence).not.toContain('Page title:');
    expect(evidence).toContain('- Tester report: Wrong total');
    expect(evidence).toContain('- Writing lens: console');
    expect(evidence).toContain(
      'Steps to reproduce (oldest first):\nNot captured\n',
    );
    expect(evidence).toContain(
      '- Primary symptom: The browser console shows an error: “Boom”.',
    );
    expect(evidence).toContain('Console evidence:');
    expect(evidence).toContain('- Category: console-error');
    expect(evidence).not.toContain('/g/collect');
    expect(evidence).not.toContain('Network evidence:');
    expect(evidence).not.toContain('No screenshots for this bug');
    expect(evidence).toContain(
      'Related signals (correlation only; do not use as Title or Actual Result):\nNot captured',
    );
  });

  it('uses a network lens for transport failures that have no HTTP status', () => {
    const prompt = buildStepsForBugTicketPrompt(
      potentialBug('bug-net', {
        issues: [{ category: 'network', issueId: 'n-fail' }],
      }),
      {
        uiIssues: [],
        consoleIssues: [],
        networkIssues: [
          networkIssue('n-fail', {
            category: 'network-failure',
            status: undefined,
            failureMessage: 'Failed to fetch',
          }),
        ],
      },
      0,
    );

    expect(prompt).toContain('WRITING LENS (network):');
    expect(prompt).toContain(
      'The POST request to /api/pay fails: “Failed to fetch”.',
    );
    expect(prompt).toContain('- Request: POST /api/pay');
    expect(prompt).toContain('- Failure: “Failed to fetch”');
    expect(prompt).not.toContain(
      'No UI message, console error, or failed request',
    );
  });

  it('uses an observation lens when only expected signals remain', () => {
    const prompt = buildStepsForBugTicketPrompt(
      potentialBug('bug-3', {
        issues: [
          { category: 'ui', issueId: 'u1' },
          { category: 'console', issueId: 'c1' },
          { category: 'network', issueId: 'missing' },
        ],
      }),
      {
        uiIssues: [uiIssue('u1', { disposition: 'excluded' })],
        consoleIssues: [consoleIssue('c1', { disposition: 'expected' })],
        networkIssues: [],
      },
      0,
    );

    expect(prompt).toContain('WRITING LENS (observation):');
    expect(prompt).toContain('Do not invent a failure, error message');
    expect(prompt).toContain(
      'Signals marked [Expected] were confirmed as expected by the tester.',
    );
    expect(evidenceSection(prompt)).toContain(
      'Related signals (correlation only; do not use as Title or Actual Result):\n- The browser console shows an error: “Boom”. [Expected]',
    );
    expect(evidenceSection(prompt)).not.toContain('Primary symptom:');
    expect(evidenceSection(prompt)).toContain('- Writing lens: observation');
    expect(evidenceSection(prompt)).toContain('- Where: /checkout');
    expect(evidenceSection(prompt)).toContain(
      'No UI message, console error, or failed request is linked. Describe only the captured flow; do not invent a failure.',
    );
  });

  it('uses an observation lens for a manual capture with no linked defect', () => {
    const prompt = buildStepsForBugTicketPrompt(
      potentialBug('bug-empty', {
        source: 'manual',
        note: 'No confirmation after submit.',
        actions: [{ actionId: 'a1', step: 'Clicked “Submit”.' }],
      }),
      { uiIssues: [], consoleIssues: [], networkIssues: [] },
      0,
    );

    expect(prompt).toContain('WRITING LENS (observation):');
    expect(evidenceSection(prompt)).toContain(
      '- Capture type: manual (Capture bug now)',
    );
    expect(evidenceSection(prompt)).toContain(
      'Actual result (from capture):\nNo confirmation after submit.',
    );
    expect(evidenceSection(prompt)).not.toContain('Primary symptom:');
    expect(evidenceSection(prompt)).not.toContain('UI evidence:');
  });

  it('prepends extra instructions from Settings when provided', () => {
    const prompt = buildStepsForBugTicketPrompt(
      potentialBug('bug-4', {
        issues: [{ category: 'ui', issueId: 'u1' }],
      }),
      {
        uiIssues: [uiIssue('u1')],
        consoleIssues: [],
        networkIssues: [],
      },
      0,
      '  Write the ticket in Russian.  ',
    );

    expect(
      prompt.startsWith('Additional team instructions from Settings'),
    ).toBe(true);
    expect(prompt).toContain('Write the ticket in Russian.');
    expect(prompt).toContain('You are a Senior QA Engineer.');
    expect(prompt).toContain('WRITING LENS (ui):');
  });
});
