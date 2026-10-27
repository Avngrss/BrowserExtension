import type { UiIssueRule } from '@/src/domain/ui-rule';

export const GET_UI_ISSUE_RULES = 'GET_UI_ISSUE_RULES';
export const SAVE_UI_ISSUE_RULE = 'SAVE_UI_ISSUE_RULE';
export const DELETE_UI_ISSUE_RULE = 'DELETE_UI_ISSUE_RULE';
export const UI_RULES_UPDATED = 'UI_RULES_UPDATED';

export type UiRuleRequestType =
  | typeof GET_UI_ISSUE_RULES
  | typeof SAVE_UI_ISSUE_RULE
  | typeof DELETE_UI_ISSUE_RULE;

export type GetUiIssueRulesMessage = {
  type: typeof GET_UI_ISSUE_RULES;
};

export type SaveUiIssueRuleMessage = {
  type: typeof SAVE_UI_ISSUE_RULE;
  rule: unknown;
};

export type DeleteUiIssueRuleMessage = {
  type: typeof DELETE_UI_ISSUE_RULE;
  ruleId: string;
};

export type UiRuleRequestMessage =
  GetUiIssueRulesMessage | SaveUiIssueRuleMessage | DeleteUiIssueRuleMessage;

export type UiRulesUpdatedMessage = {
  type: typeof UI_RULES_UPDATED;
  rules: UiIssueRule[];
};

export type UiRuleListResponse =
  | { ok: true; rules: UiIssueRule[] }
  | { ok: false; error: { code: string; message: string } };
