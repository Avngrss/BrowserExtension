import { describe, expect, it } from 'vitest';
import {
  classifyBugTicketLens,
  lensInstructionLines,
  primarySymptomText,
  relatedPromptSignals,
  writingLensContextLine,
} from '@/src/prompt/bug-ticket-lens';

describe('classifyBugTicketLens', () => {
  it('prefers UI as primary when several defect categories are present', () => {
    expect(
      classifyBugTicketLens([
        { category: 'console', expected: false },
        { category: 'network', expected: false },
        { category: 'ui', expected: false },
      ]),
    ).toEqual({ kind: 'mixed', primaryCategory: 'ui' });
  });

  it('uses a single defect category as the lens', () => {
    expect(
      classifyBugTicketLens([{ category: 'network', expected: false }]),
    ).toEqual({ kind: 'network', primaryCategory: 'network' });
  });

  it('ignores expected signals when choosing the lens', () => {
    expect(
      classifyBugTicketLens([
        { category: 'ui', expected: true },
        { category: 'console', expected: false },
      ]),
    ).toEqual({ kind: 'console', primaryCategory: 'console' });
  });

  it('falls back to observation when nothing is a defect', () => {
    expect(
      classifyBugTicketLens([{ category: 'console', expected: true }]),
    ).toEqual({ kind: 'observation', primaryCategory: null });
  });
});

describe('primarySymptomText and relatedPromptSignals', () => {
  const signals = [
    { category: 'ui' as const, expected: false, text: 'UI fail' },
    { category: 'console' as const, expected: false, text: 'Console fail' },
    { category: 'network' as const, expected: true, text: 'Expected 404' },
  ];
  const lens = { kind: 'mixed' as const, primaryCategory: 'ui' as const };

  it('takes the primary category text and leaves the rest as related', () => {
    expect(primarySymptomText(signals, lens)).toBe('UI fail');
    expect(relatedPromptSignals(signals, lens)).toEqual([
      { category: 'console', expected: false, text: 'Console fail' },
      { category: 'network', expected: true, text: 'Expected 404' },
    ]);
  });
});

describe('lens copy', () => {
  it('names mixed primary in the heading and context line', () => {
    const lens = { kind: 'mixed' as const, primaryCategory: 'ui' as const };
    expect(writingLensContextLine(lens)).toBe(
      '- Writing lens: mixed (primary: ui)',
    );
    expect(lensInstructionLines(lens)[0]).toBe(
      'WRITING LENS (mixed, primary: ui):',
    );
  });
});
