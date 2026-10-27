import type { UiIssueRule } from '@/src/domain/ui-rule';

export const DEFAULT_UI_ISSUE_RULES: readonly UiIssueRule[] = [
  {
    id: 'default-role-alert',
    name: 'Alert role',
    selector: '[role="alert"]',
    severity: 'error',
    enabled: true,
  },
  {
    id: 'default-aria-invalid',
    name: 'Invalid field',
    selector: '[aria-invalid="true"]',
    severity: 'error',
    enabled: true,
  },
  {
    id: 'default-testid-error',
    name: 'Test error message',
    selector: '[data-testid="error-message"]',
    severity: 'error',
    enabled: true,
  },
  {
    id: 'default-qa-error',
    name: 'QA error message',
    selector: '[data-qa="error-message"]',
    severity: 'error',
    enabled: true,
  },
];
