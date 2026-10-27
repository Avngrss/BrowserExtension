import { describe, expect, it } from 'vitest';
import {
  issueMarkNoteForSave,
  validateIssueMarkNote,
} from '@/src/issue-marks/issue-mark-note';

describe('issue mark note', () => {
  it('accepts empty notes and rejects overly long notes', () => {
    expect(validateIssueMarkNote('')).toBeUndefined();
    expect(validateIssueMarkNote('  hello  ')).toBeUndefined();
    expect(validateIssueMarkNote('x'.repeat(1_001))).toMatch(/1000/);
  });

  it('normalizes notes before save', () => {
    expect(issueMarkNoteForSave('  line one  ')).toBe('line one');
    expect(issueMarkNoteForSave('   ')).toBeUndefined();
  });
});
