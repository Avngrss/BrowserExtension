import type { UiIssueRule, UiIssueRuleSeverity } from '@/src/domain/ui-rule';
import {
  MAX_UI_RULE_NAME_LENGTH,
  MAX_UI_RULE_SELECTOR_LENGTH,
} from '@/src/ui/ui-issue-limits';
import { isValidCssSelector } from '@/src/ui/selector-validation';

const SEVERITIES: readonly UiIssueRuleSeverity[] = ['warning', 'error'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSeverity(value: unknown): value is UiIssueRuleSeverity {
  return (
    typeof value === 'string' &&
    SEVERITIES.some((severity) => severity === value)
  );
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

export function parseUiIssueRule(value: unknown): UiIssueRule | null {
  if (!isRecord(value)) {
    return null;
  }
  if (!hasOnlyKeys(value, ['id', 'name', 'selector', 'severity', 'enabled'])) {
    return null;
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  if (
    typeof value.name !== 'string' ||
    value.name.length === 0 ||
    value.name.length > MAX_UI_RULE_NAME_LENGTH
  ) {
    return null;
  }
  if (
    typeof value.selector !== 'string' ||
    value.selector.length === 0 ||
    value.selector.length > MAX_UI_RULE_SELECTOR_LENGTH ||
    !isValidCssSelector(value.selector)
  ) {
    return null;
  }
  if (!isSeverity(value.severity)) {
    return null;
  }
  if (typeof value.enabled !== 'boolean') {
    return null;
  }

  return {
    id: value.id,
    name: value.name.trim(),
    selector: value.selector.trim(),
    severity: value.severity,
    enabled: value.enabled,
  };
}

export function parseUiIssueRuleList(value: unknown): UiIssueRule[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const rules: UiIssueRule[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    const parsed = parseUiIssueRule(item);
    if (parsed === null || ids.has(parsed.id)) {
      return null;
    }
    ids.add(parsed.id);
    rules.push(parsed);
  }
  return rules;
}
