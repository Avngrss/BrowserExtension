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
  it('lists only captured facts for an automatic bug', () => {
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
        networkIssues: [networkIssue('n1', { durationMs: 120 })],
      },
      2,
    );

    expect(prompt).toContain(
      'Do not invent expected behavior, root cause, or details that are not listed.',
    );
    expect(prompt).toContain('otherwise write "To be confirmed by the tester"');
    expect(prompt).not.toContain('[Expected]');
    expect(evidenceSection(prompt)).toBe(
      [
        'Page URL: https://shop.test/checkout',
        'Page title: Checkout',
        'Detected at: 1970-01-01T00:00:01.000Z',
        'Detection: Detected automatically during capture',
        '',
        'Tester note:',
        'Not captured',
        '',
        'Steps (captured browser actions, oldest first):',
        '1. Opened /checkout.',
        '2. Clicked “Pay”.',
        '',
        'Observed problems:',
        '- UI error: Payment unavailable',
        '- Console error: Boom · 3 occurrences',
        '- Fetch POST /api/pay · status 500 · 120 ms',
        '',
        'Screenshots: 2 captured in Bug Capture Assistant (not included in this text).',
      ].join('\n'),
    );
  });

  it('uses the tester note and marks missing evidence for a manual bug', () => {
    const evidence = evidenceSection(
      buildStepsForBugTicketPrompt(
        potentialBug('bug-2', { source: 'manual', note: '  Wrong total  ' }),
        { uiIssues: [], consoleIssues: [], networkIssues: [] },
        0,
      ),
    );

    expect(evidence).not.toContain('Page title:');
    expect(evidence).toContain('Detection: Captured manually by the tester');
    expect(evidence).toContain('Tester note:\nWrong total\n');
    expect(evidence).toContain(
      'Steps (captured browser actions, oldest first):\nNot captured\n',
    );
    expect(evidence).toContain('Observed problems:\nNot captured\n');
    expect(evidence).toContain('Screenshots: 0 captured');
  });

  it('skips excluded and unknown issues and marks expected ones', () => {
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

    expect(prompt).toContain(
      'Problems marked [Expected] were confirmed as expected behavior by the tester.',
    );
    expect(evidenceSection(prompt)).toContain(
      'Observed problems:\n- Console error: Boom [Expected]\n\n',
    );
    expect(prompt).not.toContain('Payment unavailable');
    expect(prompt).not.toContain('/api/pay');
  });
});
