import { UiIssueStore } from '@/src/ui/ui-issue-store';
import type { SessionSnapshot } from '@/src/domain/session';
import { createMockUiIssueStorage } from './mock-ui-issue-storage';
import { UiRuleStore } from '@/src/ui/ui-rule-store';
import { createMockUiRuleStorage } from './mock-ui-rule-storage';

const DEFAULT_RULES_FOR_TESTS = [
  {
    id: 'rule-1',
    name: 'Alert role',
    selector: '[role="alert"]',
    severity: 'error' as const,
    enabled: true,
  },
];

export function createTestUiRuleStore(initial = DEFAULT_RULES_FOR_TESTS) {
  return new UiRuleStore(createMockUiRuleStorage([...initial]));
}

export function createTestUiIssueStore(
  getSessionState: () => SessionSnapshot,
  ruleStore?: UiRuleStore,
) {
  let id = 0;
  const rules = ruleStore ?? createTestUiRuleStore();
  return new UiIssueStore(createMockUiIssueStorage(), {
    getSessionState,
    createIssueId: () => `ui-${++id}`,
    ruleStore: rules,
  });
}
