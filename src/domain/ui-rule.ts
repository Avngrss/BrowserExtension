export type UiIssueRuleSeverity = 'warning' | 'error';

export type UiIssueRule = {
  id: string;
  name: string;
  selector: string;
  severity: UiIssueRuleSeverity;
  enabled: boolean;
};
