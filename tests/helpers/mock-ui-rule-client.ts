import type { UiIssueRule } from '@/src/domain/ui-rule';
import { DEFAULT_UI_ISSUE_RULES } from '@/src/ui/default-ui-rules';
import { validateUiIssueRuleRecord } from '@/src/ui/ui-rule-form-validation';

let rules: UiIssueRule[] = DEFAULT_UI_ISSUE_RULES.map((rule) => ({ ...rule }));
const listeners = new Set<(next: UiIssueRule[]) => void>();
let saveShouldFail = false;
let loadShouldReturnMalformed = false;

function notify(): void {
  for (const listener of listeners) {
    listener(rules);
  }
}

export const uiRuleClientMock = {
  reset(): void {
    rules = DEFAULT_UI_ISSUE_RULES.map((rule) => ({ ...rule }));
    listeners.clear();
    saveShouldFail = false;
    loadShouldReturnMalformed = false;
  },
  setSaveShouldFail(value: boolean): void {
    saveShouldFail = value;
  },
  setLoadShouldReturnMalformed(value: boolean): void {
    loadShouldReturnMalformed = value;
  },
  getRules(): Promise<
    | { ok: true; rules: UiIssueRule[] }
    | { ok: false; error: { code: string; message: string } }
  > {
    if (loadShouldReturnMalformed) {
      return Promise.resolve({
        ok: true,
        rules: [{ id: 'broken' }] as unknown as UiIssueRule[],
      });
    }
    return Promise.resolve({ ok: true, rules: [...rules] });
  },
  saveRule(
    rule: UiIssueRule,
  ): Promise<
    | { ok: true; rules: UiIssueRule[] }
    | { ok: false; error: { code: string; message: string } }
  > {
    if (saveShouldFail) {
      return Promise.resolve({
        ok: false,
        error: {
          code: 'STORAGE_ERROR',
          message: 'UI issue rules could not be saved.',
        },
      });
    }
    const validated = validateUiIssueRuleRecord(rule);
    if (!validated.ok) {
      return Promise.resolve({
        ok: false,
        error: { code: 'INVALID_UI_RULE', message: validated.message },
      });
    }
    const parsed = validated.rule;
    const next = [...rules];
    const index = next.findIndex((entry) => entry.id === parsed.id);
    if (index >= 0) {
      next[index] = parsed;
    } else {
      next.push(parsed);
    }
    rules = next;
    notify();
    return Promise.resolve({ ok: true, rules: [...rules] });
  },
  deleteRule(
    ruleId: string,
  ): Promise<
    | { ok: true; rules: UiIssueRule[] }
    | { ok: false; error: { code: string; message: string } }
  > {
    rules = rules.filter((rule) => rule.id !== ruleId);
    notify();
    return Promise.resolve({ ok: true, rules: [...rules] });
  },
  subscribe(listener: (next: UiIssueRule[]) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function resetUiRuleClientMock(): void {
  uiRuleClientMock.reset();
}
