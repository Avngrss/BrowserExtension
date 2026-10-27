import type { UiIssueRule } from '@/src/domain/ui-rule';
import {
  DELETE_UI_ISSUE_RULE,
  GET_UI_ISSUE_RULES,
  SAVE_UI_ISSUE_RULE,
  type UiRuleListResponse,
} from '@/src/messaging/ui-rule-types';
import { isUiRulesUpdatedMessage } from '@/src/messaging/ui-rule-messages';
import { parseUiIssueRuleList } from '@/src/ui/ui-rule-validation';
import { browser } from 'wxt/browser';

function isUiRuleListResponse(value: unknown): value is UiRuleListResponse {
  if (typeof value !== 'object' || value === null || !('ok' in value)) {
    return false;
  }
  if (value.ok !== true) {
    return (
      'error' in value &&
      typeof (value as { error?: unknown }).error === 'object'
    );
  }
  if (!('rules' in value)) {
    return false;
  }
  return parseUiIssueRuleList((value as { rules: unknown }).rules) !== null;
}

export const uiRuleClient = {
  async getRules(): Promise<UiRuleListResponse> {
    const response: unknown = await browser.runtime.sendMessage({
      type: GET_UI_ISSUE_RULES,
    });
    if (!isUiRuleListResponse(response)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: 'Could not load UI issue rules.',
        },
      };
    }
    return response;
  },
  async saveRule(rule: UiIssueRule): Promise<UiRuleListResponse> {
    const response: unknown = await browser.runtime.sendMessage({
      type: SAVE_UI_ISSUE_RULE,
      rule,
    });
    if (!isUiRuleListResponse(response)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: 'Could not save the UI issue rule.',
        },
      };
    }
    return response;
  },
  async deleteRule(ruleId: string): Promise<UiRuleListResponse> {
    const response: unknown = await browser.runtime.sendMessage({
      type: DELETE_UI_ISSUE_RULE,
      ruleId,
    });
    if (!isUiRuleListResponse(response)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: 'Could not delete the UI issue rule.',
        },
      };
    }
    return response;
  },
  subscribe(onRules: (rules: UiIssueRule[]) => void): () => void {
    const listener = (message: unknown): void => {
      if (isUiRulesUpdatedMessage(message)) {
        onRules(message.rules);
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  },
};
