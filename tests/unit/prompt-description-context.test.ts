import { describe, expect, it } from 'vitest';
import {
  buildPromptActualResultFact,
  buildPromptDescriptionContext,
} from '@/src/prompt/prompt-description-context';
import { potentialBug } from '../helpers/potential-bug-fixtures';

describe('buildPromptDescriptionContext', () => {
  it('combines page, flow, primary symptom, and writing lens', () => {
    const lines = buildPromptDescriptionContext(
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
      { kind: 'mixed', primaryCategory: 'ui' },
      'The page shows “Payment unavailable”.',
    );

    expect(lines).toEqual([
      '- Where: Checkout (/checkout)',
      '- Flow leading to the issue: Opened /checkout. Then Clicked “Pay”.',
      '- Primary symptom: The page shows “Payment unavailable”.',
      '- Writing lens: mixed (primary: ui)',
      '- Capture type: automatic',
    ]);
  });

  it('keeps tester report and console primary when a note is present', () => {
    const lines = buildPromptDescriptionContext(
      potentialBug('bug-2', {
        source: 'manual',
        note: 'Wrong total',
        issues: [{ category: 'console', issueId: 'c1' }],
      }),
      { kind: 'console', primaryCategory: 'console' },
      'The browser console shows an error: “Boom”.',
    );

    expect(lines).toContain('- Tester report: Wrong total');
    expect(lines).toContain(
      '- Primary symptom: The browser console shows an error: “Boom”.',
    );
    expect(lines).toContain('- Writing lens: console');
    expect(lines).toContain('- Capture type: manual');
  });
});

describe('buildPromptActualResultFact', () => {
  it('uses the primary symptom when present', () => {
    expect(
      buildPromptActualResultFact(
        potentialBug('bug-1', {
          issues: [{ category: 'console', issueId: 'c1' }],
        }),
        'The browser console shows an error: “BCA manual console error A”.',
      ),
    ).toBe('The browser console shows an error: “BCA manual console error A”.');
  });

  it('falls back to the tester note when there is no primary symptom', () => {
    expect(
      buildPromptActualResultFact(
        potentialBug('bug-2', {
          source: 'manual',
          note: 'Wrong total',
        }),
        null,
      ),
    ).toBe('Wrong total');
  });
});
