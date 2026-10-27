import { describe, expect, it } from 'vitest';
import { parseActionSubmissionPayload } from '@/src/actions/action-validation';

const base = {
  sessionId: 'session-1',
  timestamp: 1_000,
  url: 'https://example.com/',
};

describe('field action validation', () => {
  it('accepts input actions without values', () => {
    expect(
      parseActionSubmissionPayload({
        type: 'input',
        ...base,
        element: { tagName: 'input', semanticType: 'textbox' },
      }),
    ).toMatchObject({ type: 'input' });
  });

  it('rejects generic value properties', () => {
    expect(
      parseActionSubmissionPayload({
        type: 'input',
        ...base,
        value: 'secret',
        element: { tagName: 'input' },
      }),
    ).toBeNull();
  });

  it('accepts change actions with checked for checkbox controls', () => {
    expect(
      parseActionSubmissionPayload({
        type: 'change',
        ...base,
        checked: true,
        element: {
          tagName: 'input',
          inputType: 'checkbox',
          semanticType: 'checkbox',
        },
      }),
    ).toMatchObject({ type: 'change', checked: true });
  });

  it('rejects checked on non-toggle controls', () => {
    expect(
      parseActionSubmissionPayload({
        type: 'change',
        ...base,
        checked: true,
        element: { tagName: 'select', semanticType: 'combobox' },
      }),
    ).toBeNull();
  });
});
