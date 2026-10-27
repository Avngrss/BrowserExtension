import { describe, expect, it } from 'vitest';
import {
  UI_ISSUE_RULE_SELECTOR_ERROR,
  validateUiIssueRuleForm,
  validateUiIssueRuleRecord,
} from '@/src/ui/ui-rule-form-validation';

describe('validateUiIssueRuleForm', () => {
  it('accepts valid selectors without requiring a DOM match', () => {
    const errors = validateUiIssueRuleForm({
      name: 'Generic alert',
      selector: '[role="alert"]',
      severity: 'error',
      enabled: true,
    });
    expect(errors).toEqual({});
    expect(
      validateUiIssueRuleForm({
        name: 'Missing node',
        selector: '#nonexistent-element-id-xyz',
        severity: 'warning',
        enabled: true,
      }).selector,
    ).toBeUndefined();
  });

  it('returns selector-specific errors for invalid CSS', () => {
    expect(
      validateUiIssueRuleForm({
        name: 'Bad',
        selector: '[role="alert"',
        severity: 'error',
        enabled: true,
      }).selector,
    ).toBe(UI_ISSUE_RULE_SELECTOR_ERROR);
    expect(
      validateUiIssueRuleForm({
        name: 'Bad',
        selector: 'div>>span',
        severity: 'error',
        enabled: true,
      }).selector,
    ).toBe(UI_ISSUE_RULE_SELECTOR_ERROR);
  });

  it('validates name independently from selector', () => {
    const errors = validateUiIssueRuleForm({
      name: '',
      selector: '[role="alert"]',
      severity: 'error',
      enabled: true,
    });
    expect(errors.name).toBeTruthy();
    expect(errors.selector).toBeUndefined();
  });
});

describe('validateUiIssueRuleRecord', () => {
  it('returns field-specific messages for invalid stored payloads', () => {
    const result = validateUiIssueRuleRecord({
      id: 'rule-1',
      name: 'Bad',
      selector: '##broken',
      severity: 'error',
      enabled: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.selector).toBe(UI_ISSUE_RULE_SELECTOR_ERROR);
      expect(result.message).toBe(UI_ISSUE_RULE_SELECTOR_ERROR);
    }
  });
});
