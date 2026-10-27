import type { UiIssueRule } from '@/src/domain/ui-rule';
import { DEFAULT_UI_ISSUE_RULES } from '@/src/ui/default-ui-rules';
import { parseUiIssueRuleList } from '@/src/ui/ui-rule-validation';
import type { UiRuleStorageAdapter } from '@/src/ui/ui-rule-storage';
import {
  validateUiIssueRuleForm,
  validateUiIssueRuleRecord,
} from '@/src/ui/ui-rule-form-validation';

export type UiRuleListResponse =
  | { ok: true; rules: UiIssueRule[] }
  | { ok: false; error: { code: string; message: string } };

export type UiRuleMutationResponse =
  | { ok: true; rules: UiIssueRule[] }
  | { ok: false; error: { code: string; message: string } };

export class UiRuleStore {
  private readonly ready: Promise<void>;
  private rules: UiIssueRule[] = [];

  constructor(private readonly storage: UiRuleStorageAdapter) {
    this.ready = this.restoreFromStorage();
  }

  waitUntilReady(): Promise<void> {
    return this.ready;
  }

  getRules(): UiIssueRule[] {
    return [...this.rules];
  }

  getEnabledRule(ruleId: string): UiIssueRule | undefined {
    return this.rules.find((rule) => rule.id === ruleId && rule.enabled);
  }

  private async restoreFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.read();
      if (stored === undefined || stored === null) {
        this.rules = DEFAULT_UI_ISSUE_RULES.map((rule) => ({ ...rule }));
        await this.storage.write(this.rules);
        return;
      }

      const parsed = parseUiIssueRuleList(stored);
      if (parsed === null || parsed.length === 0) {
        this.rules = DEFAULT_UI_ISSUE_RULES.map((rule) => ({ ...rule }));
        await this.storage.write(this.rules);
        return;
      }

      this.rules = parsed;
    } catch {
      this.rules = DEFAULT_UI_ISSUE_RULES.map((rule) => ({ ...rule }));
    }
  }

  async getRuleList(): Promise<UiRuleListResponse> {
    await this.ready;
    return { ok: true, rules: this.getRules() };
  }

  async saveRule(rawRule: unknown): Promise<UiRuleMutationResponse> {
    await this.ready;
    const validated = validateUiIssueRuleRecord(rawRule);
    if (!validated.ok) {
      return {
        ok: false,
        error: {
          code: 'INVALID_UI_RULE',
          message: validated.message,
        },
      };
    }
    const parsed = validated.rule;

    const next = [...this.rules];
    const index = next.findIndex((rule) => rule.id === parsed.id);
    if (index >= 0) {
      next[index] = parsed;
    } else {
      next.push(parsed);
    }

    try {
      await this.storage.write(next);
    } catch {
      return {
        ok: false,
        error: {
          code: 'STORAGE_ERROR',
          message: 'UI issue rules could not be saved.',
        },
      };
    }

    this.rules = next;
    return { ok: true, rules: this.getRules() };
  }

  async deleteRule(ruleId: unknown): Promise<UiRuleMutationResponse> {
    await this.ready;
    if (typeof ruleId !== 'string' || ruleId.length === 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_UI_RULE',
          message: 'The rule id is invalid.',
        },
      };
    }

    const next = this.rules.filter((rule) => rule.id !== ruleId);
    if (next.length === this.rules.length) {
      return {
        ok: false,
        error: {
          code: 'INVALID_UI_RULE',
          message: 'The rule could not be found.',
        },
      };
    }

    try {
      await this.storage.write(next);
    } catch {
      return {
        ok: false,
        error: {
          code: 'STORAGE_ERROR',
          message: 'UI issue rules could not be saved.',
        },
      };
    }

    this.rules = next;
    return { ok: true, rules: this.getRules() };
  }

  validateDraft(input: {
    name: string;
    selector: string;
    severity: UiIssueRule['severity'];
    enabled?: boolean;
  }): string | undefined {
    const errors = validateUiIssueRuleForm({
      name: input.name,
      selector: input.selector,
      severity: input.severity,
      enabled: input.enabled ?? true,
    });
    return (
      errors.name ??
      errors.selector ??
      errors.severity ??
      errors.enabled ??
      undefined
    );
  }
}
