import { describe, expect, it } from 'vitest';
import { BUG_REPORT_CONTEXT_FIELD_MAX_LENGTH } from '@/src/domain/bug-report-context';
import {
  bugReportContextFieldForSave,
  validateBugReportContextField,
} from '@/src/bug-report/bug-report-context-fields';

describe('bug report context fields', () => {
  it('allows empty optional fields', () => {
    expect(validateBugReportContextField('', 'What happened?')).toBeUndefined();
    expect(bugReportContextFieldForSave('   ')).toBeUndefined();
  });

  it('rejects fields over the maximum length', () => {
    const tooLong = 'x'.repeat(BUG_REPORT_CONTEXT_FIELD_MAX_LENGTH + 1);
    expect(validateBugReportContextField(tooLong, 'What was expected?')).toBe(
      `What was expected? must be ${BUG_REPORT_CONTEXT_FIELD_MAX_LENGTH} characters or fewer.`,
    );
  });
});
