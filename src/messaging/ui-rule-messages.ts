import { parseUiIssueRuleList } from '@/src/ui/ui-rule-validation';
import type { UiRuleStore } from '@/src/ui/ui-rule-store';
import {
  DELETE_UI_ISSUE_RULE,
  GET_UI_ISSUE_RULES,
  SAVE_UI_ISSUE_RULE,
  UI_RULES_UPDATED,
  type UiRuleListResponse,
  type UiRuleRequestMessage,
  type UiRuleRequestType,
  type UiRulesUpdatedMessage,
} from '@/src/messaging/ui-rule-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const UI_RULE_REQUEST_TYPES: readonly UiRuleRequestType[] = [
  GET_UI_ISSUE_RULES,
  SAVE_UI_ISSUE_RULE,
  DELETE_UI_ISSUE_RULE,
];

function isUiRuleRequestType(value: unknown): value is UiRuleRequestType {
  return (
    typeof value === 'string' &&
    UI_RULE_REQUEST_TYPES.some((requestType) => requestType === value)
  );
}

export function isUiRuleRequestMessage(
  message: unknown,
): message is UiRuleRequestMessage {
  return isRecord(message) && isUiRuleRequestType(message.type);
}

export function isUiRulesUpdatedMessage(
  message: unknown,
): message is UiRulesUpdatedMessage {
  if (!isRecord(message) || message.type !== UI_RULES_UPDATED) {
    return false;
  }
  return parseUiIssueRuleList(message.rules) !== null;
}

export async function handleUiRuleRequestMessage(
  message: UiRuleRequestMessage,
  ruleStore: UiRuleStore,
): Promise<UiRuleListResponse | undefined> {
  if (message.type === GET_UI_ISSUE_RULES) {
    return ruleStore.getRuleList();
  }

  if (message.type === SAVE_UI_ISSUE_RULE) {
    return ruleStore.saveRule(message.rule);
  }

  if (message.type === DELETE_UI_ISSUE_RULE) {
    return ruleStore.deleteRule(message.ruleId);
  }

  return undefined;
}

export function createUiRulesUpdatedMessage(
  rules: UiRulesUpdatedMessage['rules'],
): UiRulesUpdatedMessage {
  return {
    type: UI_RULES_UPDATED,
    rules,
  };
}

export function shouldBroadcastUiRulesUpdate(
  message: unknown,
  response: unknown,
): response is { ok: true; rules: UiRulesUpdatedMessage['rules'] } {
  return (
    isUiRuleRequestMessage(message) &&
    (message.type === SAVE_UI_ISSUE_RULE ||
      message.type === DELETE_UI_ISSUE_RULE) &&
    isRecord(response) &&
    response.ok === true &&
    parseUiIssueRuleList(response.rules) !== null
  );
}
