import type { UiIssueRule, UiIssueRuleSeverity } from '@/src/domain/ui-rule';
import {
  MAX_UI_RULE_NAME_LENGTH,
  MAX_UI_RULE_SELECTOR_LENGTH,
} from '@/src/ui/ui-issue-limits';
import { isValidCssSelector } from '@/src/ui/selector-validation';

export type UiIssueRuleFormField = 'name' | 'selector' | 'severity' | 'enabled';

export type UiIssueRuleFormErrors = Partial<
  Record<UiIssueRuleFormField, string>
>;

export type UiIssueRuleDraftInput = {
  name: string;
  selector: string;
  severity: UiIssueRuleSeverity;
  enabled: boolean;
};

export const UI_ISSUE_RULE_SELECTOR_ERROR = 'Enter a valid CSS selector.';
export const UI_ISSUE_RULE_NAME_ERROR =
  'Enter a rule name up to 120 characters.';
export const UI_ISSUE_RULE_SEVERITY_ERROR = 'Choose warning or error severity.';
export const UI_ISSUE_RULE_ENABLED_ERROR = 'Enabled must be on or off.';

export function validateUiIssueRuleForm(
  draft: UiIssueRuleDraftInput,
): UiIssueRuleFormErrors {
  const errors: UiIssueRuleFormErrors = {};
  const name = draft.name.trim();
  if (name.length === 0 || name.length > MAX_UI_RULE_NAME_LENGTH) {
    errors.name = UI_ISSUE_RULE_NAME_ERROR;
  }

  const selector = draft.selector.trim();
  if (selector.length === 0 || selector.length > MAX_UI_RULE_SELECTOR_LENGTH) {
    errors.selector = UI_ISSUE_RULE_SELECTOR_ERROR;
  } else if (!isValidCssSelector(selector)) {
    errors.selector = UI_ISSUE_RULE_SELECTOR_ERROR;
  }

  if (draft.severity !== 'warning' && draft.severity !== 'error') {
    errors.severity = UI_ISSUE_RULE_SEVERITY_ERROR;
  }

  if (typeof draft.enabled !== 'boolean') {
    errors.enabled = UI_ISSUE_RULE_ENABLED_ERROR;
  }

  return errors;
}

export function firstUiIssueRuleFormError(
  errors: UiIssueRuleFormErrors,
): string | undefined {
  return (
    errors.name ??
    errors.selector ??
    errors.severity ??
    errors.enabled ??
    undefined
  );
}

export function validateUiIssueRuleRecord(
  value: unknown,
):
  | { ok: true; rule: UiIssueRule }
  | { ok: false; errors: UiIssueRuleFormErrors; message: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      ok: false,
      errors: { name: UI_ISSUE_RULE_NAME_ERROR },
      message: UI_ISSUE_RULE_NAME_ERROR,
    };
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return {
      ok: false,
      errors: { name: 'The rule id is invalid.' },
      message: 'The rule id is invalid.',
    };
  }

  const severity: UiIssueRuleSeverity | 'invalid' =
    record.severity === 'warning' || record.severity === 'error'
      ? record.severity
      : 'invalid';

  const draft: UiIssueRuleDraftInput = {
    name: typeof record.name === 'string' ? record.name : '',
    selector: typeof record.selector === 'string' ? record.selector : '',
    severity: severity === 'invalid' ? 'error' : severity,
    enabled:
      typeof record.enabled === 'boolean'
        ? record.enabled
        : (null as unknown as boolean),
  };

  const errors = validateUiIssueRuleForm(draft);
  if (severity === 'invalid') {
    errors.severity = UI_ISSUE_RULE_SEVERITY_ERROR;
  }
  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      message:
        firstUiIssueRuleFormError(errors) ?? 'The UI issue rule is invalid.',
    };
  }

  return {
    ok: true,
    rule: {
      id: record.id,
      name: draft.name.trim(),
      selector: draft.selector.trim(),
      severity: draft.severity,
      enabled: record.enabled as boolean,
    },
  };
}
