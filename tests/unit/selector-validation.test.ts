import { describe, expect, it } from 'vitest';
import { isValidCssSelector } from '@/src/ui/selector-validation';

describe('isValidCssSelector', () => {
  it('accepts common valid selectors', () => {
    expect(isValidCssSelector('[role="alert"]')).toBe(true);
    expect(isValidCssSelector('[aria-invalid="true"]')).toBe(true);
    expect(isValidCssSelector('.error-message')).toBe(true);
    expect(isValidCssSelector('#validation-error')).toBe(true);
    expect(isValidCssSelector('[data-testid="error-message"]')).toBe(true);
    expect(isValidCssSelector('form .field-error')).toBe(true);
  });

  it('rejects invalid selectors', () => {
    expect(isValidCssSelector('[role="alert"')).toBe(false);
    expect(isValidCssSelector('div>>span')).toBe(false);
    expect(isValidCssSelector('[]')).toBe(false);
    expect(isValidCssSelector('##invalid')).toBe(false);
    expect(isValidCssSelector('')).toBe(false);
    expect(isValidCssSelector('   ')).toBe(false);
  });

  it('does not require the selector to match a probe element', () => {
    expect(isValidCssSelector('#nonexistent-element-id-xyz')).toBe(true);
  });
});
