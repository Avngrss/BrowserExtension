import type { UiIssueRule } from '@/src/domain/ui-rule';
import { browser } from 'wxt/browser';

export const UI_ISSUE_RULES_STORAGE_KEY = 'bugCaptureAssistant.uiIssueRules';

export type UiRuleStorageAdapter = {
  read(): Promise<unknown>;
  write(rules: UiIssueRule[]): Promise<void>;
};

export function createBrowserUiRuleStorage(): UiRuleStorageAdapter {
  return {
    async read(): Promise<unknown> {
      const result = await browser.storage.local.get(
        UI_ISSUE_RULES_STORAGE_KEY,
      );
      return result[UI_ISSUE_RULES_STORAGE_KEY];
    },
    async write(rules: UiIssueRule[]): Promise<void> {
      await browser.storage.local.set({ [UI_ISSUE_RULES_STORAGE_KEY]: rules });
    },
  };
}
