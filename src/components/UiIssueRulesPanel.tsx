import {
  useCallback,
  useEffect,
  useReducer,
  useState,
  type FormEvent,
} from 'react';
import type { UiIssueRule, UiIssueRuleSeverity } from '@/src/domain/ui-rule';
import { Button } from '@/src/components/Button';
import { SectionCard } from '@/src/components/SectionCard';
import { UiIssueRulesPanelErrorBoundary } from '@/src/components/UiIssueRulesPanelErrorBoundary';
import {
  validateUiIssueRuleForm,
  type UiIssueRuleFormErrors,
} from '@/src/ui/ui-rule-form-validation';
import { uiRuleClient } from '@/src/utils/ui-rule-client';

type RuleDraft = {
  id?: string;
  name: string;
  selector: string;
  severity: UiIssueRuleSeverity;
  enabled: boolean;
};

const EMPTY_DRAFT: RuleDraft = {
  name: '',
  selector: '',
  severity: 'error',
  enabled: true,
};

function normalizeRules(value: unknown): UiIssueRule[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (rule): rule is UiIssueRule =>
      typeof rule === 'object' &&
      rule !== null &&
      typeof (rule as UiIssueRule).id === 'string' &&
      typeof (rule as UiIssueRule).name === 'string' &&
      typeof (rule as UiIssueRule).selector === 'string',
  );
}

type UiIssueRulesPanelContentProps = {
  reloadToken: number;
};

function UiIssueRulesPanelContent({
  reloadToken,
}: UiIssueRulesPanelContentProps) {
  const [rules, setRules] = useState<UiIssueRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [formKey, setFormKey] = useState(0);
  const [formDefaults, setFormDefaults] = useState<RuleDraft>(EMPTY_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<UiIssueRuleFormErrors>({});
  const [mutationError, setMutationError] = useState<string | undefined>(
    undefined,
  );

  const loadRules = useCallback(async (activeRef: { current: boolean }) => {
    setLoadError(undefined);
    const response = await uiRuleClient.getRules();
    if (!activeRef.current) {
      return;
    }
    if (!response.ok) {
      setLoadError(response.error.message);
      setLoading(false);
      return;
    }
    setRules(normalizeRules(response.rules));
    setLoading(false);
  }, []);

  useEffect(() => {
    const activeRef = { current: true };
    setLoading(true);
    void loadRules(activeRef);

    const unsubscribe = uiRuleClient.subscribe((nextRules) => {
      if (activeRef.current) {
        setRules(normalizeRules(nextRules));
        setLoadError(undefined);
      }
    });

    return () => {
      activeRef.current = false;
      unsubscribe();
    };
  }, [loadRules, reloadToken]);

  async function persistRule(nextRule: UiIssueRule): Promise<boolean> {
    setMutationError(undefined);
    const response = await uiRuleClient.saveRule(nextRule);
    if (!response.ok) {
      setMutationError(response.error.message);
      return false;
    }
    setRules(normalizeRules(response.rules));
    return true;
  }

  async function handleSaveDraft(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nameValue = formData.get('name');
    const selectorValue = formData.get('selector');
    const name = typeof nameValue === 'string' ? nameValue : '';
    const selector = typeof selectorValue === 'string' ? selectorValue : '';
    const severityValue = formData.get('severity');
    const severity =
      severityValue === 'warning' || severityValue === 'error'
        ? severityValue
        : formDefaults.severity;
    const enabled = formData.get('enabled') === 'on';
    const ruleIdValue = formData.get('ruleId');
    const ruleId = (typeof ruleIdValue === 'string' ? ruleIdValue : '').trim();

    const nextDraft: RuleDraft = {
      id: ruleId.length > 0 ? ruleId : undefined,
      name,
      selector,
      severity,
      enabled,
    };

    const errors = validateUiIssueRuleForm(nextDraft);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const nextRule: UiIssueRule = {
      id: nextDraft.id ?? crypto.randomUUID(),
      name: name.trim(),
      selector: selector.trim(),
      severity,
      enabled,
    };

    const saved = await persistRule(nextRule);
    if (saved) {
      setFormDefaults(EMPTY_DRAFT);
      setFieldErrors({});
      setFormKey((current) => current + 1);
    }
  }

  function handleEditRule(rule: UiIssueRule): void {
    setFormDefaults({
      id: rule.id,
      name: rule.name,
      selector: rule.selector,
      severity: rule.severity,
      enabled: rule.enabled,
    });
    setFieldErrors({});
    setMutationError(undefined);
    setFormKey((current) => current + 1);
  }

  function resetRuleForm(): void {
    setFormDefaults(EMPTY_DRAFT);
    setFieldErrors({});
    setFormKey((current) => current + 1);
  }

  async function handleToggleRule(rule: UiIssueRule): Promise<void> {
    const nextRule = { ...rule, enabled: !rule.enabled };
    setRules((current) =>
      current.map((entry) => (entry.id === rule.id ? nextRule : entry)),
    );
    const saved = await persistRule(nextRule);
    if (!saved) {
      setRules((current) =>
        current.map((entry) => (entry.id === rule.id ? rule : entry)),
      );
    }
  }

  async function handleDeleteRule(ruleId: string): Promise<void> {
    setMutationError(undefined);
    const response = await uiRuleClient.deleteRule(ruleId);
    if (!response.ok) {
      setMutationError(response.error.message);
      return;
    }
    setRules(normalizeRules(response.rules));
    if (formDefaults.id === ruleId) {
      resetRuleForm();
    }
  }

  const selectorErrorId = 'ui-rule-selector-error';
  const nameErrorId = 'ui-rule-name-error';

  return (
    <SectionCard
      title="UI issue rules"
      description="Selector rules flag visible interface problems in the monitored tab while recording."
    >
      {loading ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Loading rules…
        </p>
      ) : null}
      {loadError !== undefined ? (
        <p role="alert" className="text-sm text-red-800 dark:text-red-200">
          {loadError}
        </p>
      ) : null}
      {!loading ? (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="rounded-md border border-slate-300 p-3 dark:border-slate-600"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-950 dark:text-slate-50">
                    {rule.name}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-600 dark:text-slate-300">
                    {rule.selector}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Severity: {rule.severity}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-1 text-xs text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    aria-label={`Enabled rule ${rule.name}`}
                    checked={rule.enabled}
                    onChange={() => {
                      void handleToggleRule(rule);
                    }}
                  />
                  Enabled
                </label>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    handleEditRule(rule);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => {
                    void handleDeleteRule(rule.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        key={formKey}
        className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-700"
        onSubmit={(event) => {
          void handleSaveDraft(event);
        }}
      >
        <input
          type="hidden"
          name="ruleId"
          value={formDefaults.id ?? ''}
          readOnly
        />
        <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
          {formDefaults.id === undefined ? 'Add rule' : 'Edit rule'}
        </h3>
        <label className="flex flex-col gap-1 text-sm">
          <span>Name</span>
          <input
            name="name"
            className="rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
            defaultValue={formDefaults.name}
            aria-invalid={fieldErrors.name !== undefined}
            aria-describedby={
              fieldErrors.name !== undefined ? nameErrorId : undefined
            }
          />
          {fieldErrors.name !== undefined ? (
            <span
              id={nameErrorId}
              role="alert"
              className="text-sm text-red-800 dark:text-red-200"
            >
              {fieldErrors.name}
            </span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>CSS selector</span>
          <input
            name="selector"
            className="rounded-md border border-slate-300 px-2 py-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-950"
            defaultValue={formDefaults.selector}
            aria-invalid={fieldErrors.selector !== undefined}
            aria-describedby={
              fieldErrors.selector !== undefined ? selectorErrorId : undefined
            }
          />
          {fieldErrors.selector !== undefined ? (
            <span
              id={selectorErrorId}
              role="alert"
              className="text-sm text-red-800 dark:text-red-200"
            >
              {fieldErrors.selector}
            </span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Severity</span>
          <select
            name="severity"
            className="rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
            defaultValue={formDefaults.severity}
          >
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={formDefaults.enabled}
          />
          Enabled
        </label>
        {mutationError !== undefined ? (
          <p role="alert" className="text-sm text-red-800 dark:text-red-200">
            {mutationError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit">
            {formDefaults.id === undefined ? 'Add rule' : 'Save changes'}
          </Button>
          {formDefaults.id !== undefined ? (
            <Button variant="secondary" type="button" onClick={resetRuleForm}>
              Cancel edit
            </Button>
          ) : null}
        </div>
      </form>
    </SectionCard>
  );
}

export function UiIssueRulesPanel() {
  const [reloadToken, dispatchReload] = useReducer(
    (count: number) => count + 1,
    0,
  );

  return (
    <UiIssueRulesPanelErrorBoundary
      onReload={() => {
        dispatchReload();
      }}
    >
      <UiIssueRulesPanelContent key={reloadToken} reloadToken={reloadToken} />
    </UiIssueRulesPanelErrorBoundary>
  );
}
