import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { CollapsibleSection } from '@/src/components/CollapsibleSection';
import { SectionCard } from '@/src/components/SectionCard';
import { UiIssueRulesPanel } from '@/src/components/UiIssueRulesPanel';
import {
  DEFAULT_EXTENSION_SETTINGS,
  type ExtensionSettings,
  validateExtensionSettings,
  type SettingsFieldErrors,
} from '@/src/settings/extension-settings';
import { writeExtensionSettingsToStorage } from '@/src/settings/extension-settings-storage';
import { GET_EXTENSION_SETTINGS } from '@/src/messaging/extension-settings-messages';
import { PRODUCT_NAME } from '@/src/utils/product';
import { browser } from 'wxt/browser';

function ToggleRow(input: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}): ReactElement {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-800 dark:text-slate-100">{input.label}</span>
      <input
        type="checkbox"
        checked={input.checked}
        disabled={input.disabled}
        onChange={(event) => {
          input.onChange(event.target.checked);
        }}
      />
    </label>
  );
}

function ScreenshotLimitField(input: {
  label: string;
  value: number;
  error: string | undefined;
  onChange: (value: number) => void;
}): ReactElement {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-800 dark:text-slate-100">{input.label}</span>
      <input
        type="number"
        min={1}
        max={50}
        step={1}
        value={input.value}
        className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
        onChange={(event) => {
          input.onChange(Number(event.target.value));
        }}
      />
      {input.error !== undefined ? (
        <span role="alert" className="text-xs text-red-700 dark:text-red-300">
          {input.error}
        </span>
      ) : null}
    </label>
  );
}

function LimitField(input: {
  label: string;
  value: number;
  error: string | undefined;
  onChange: (value: number) => void;
}): ReactElement {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-800 dark:text-slate-100">{input.label}</span>
      <input
        type="number"
        min={10}
        max={1000}
        step={1}
        value={input.value}
        className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
        onChange={(event) => {
          input.onChange(Number(event.target.value));
        }}
      />
      {input.error !== undefined ? (
        <span role="alert" className="text-xs text-red-700 dark:text-red-300">
          {input.error}
        </span>
      ) : null}
    </label>
  );
}

export function App() {
  const [settings, setSettings] = useState<ExtensionSettings>(
    DEFAULT_EXTENSION_SETTINGS,
  );
  const [errors, setErrors] = useState<SettingsFieldErrors>({});
  const [savedNotice, setSavedNotice] = useState<string | undefined>(undefined);
  const promptSaveTimer = useRef<number | undefined>(undefined);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    return () => {
      if (promptSaveTimer.current !== undefined) {
        window.clearTimeout(promptSaveTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    void browser.runtime
      .sendMessage({ type: GET_EXTENSION_SETTINGS })
      .then((response: unknown) => {
        if (
          typeof response === 'object' &&
          response !== null &&
          'ok' in response &&
          response.ok === true &&
          'settings' in response
        ) {
          setSettings((response as { settings: ExtensionSettings }).settings);
        }
      })
      .catch(() => undefined);
  }, []);

  const persist = useCallback(async (next: ExtensionSettings) => {
    const fieldErrors = validateExtensionSettings(next);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      return;
    }
    setSettings(next);
    await writeExtensionSettingsToStorage(next);
    setSavedNotice('Settings saved.');
  }, []);

  const persistPromptInstructions = useCallback((value: string) => {
    const next: ExtensionSettings = {
      ...settingsRef.current,
      prompt: { extraInstructions: value },
    };
    const fieldErrors = validateExtensionSettings(next);
    setErrors(fieldErrors);
    setSettings(next);
    if (Object.keys(fieldErrors).length > 0) {
      return;
    }
    window.clearTimeout(promptSaveTimer.current);
    promptSaveTimer.current = window.setTimeout(() => {
      void writeExtensionSettingsToStorage(next).then(() => {
        setSavedNotice('Settings saved.');
      });
    }, 400);
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <header>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {PRODUCT_NAME}
        </p>
        <h1 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
          Settings
        </h1>
      </header>

      {savedNotice !== undefined ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {savedNotice}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <SectionCard
          title="Capture"
          description="The current tab is selected automatically when you start capture. No URL setup is required."
        >
          <div className="flex flex-col gap-3">
            <ToggleRow
              label="Capture actions"
              checked={settings.capture.captureActions}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  capture: { ...settings.capture, captureActions: checked },
                });
              }}
            />
            <ToggleRow
              label="Capture UI issues"
              checked={settings.capture.captureUiIssues}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  capture: { ...settings.capture, captureUiIssues: checked },
                });
              }}
            />
            <ToggleRow
              label="Capture console errors"
              checked={settings.capture.captureConsoleErrors}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  capture: {
                    ...settings.capture,
                    captureConsoleErrors: checked,
                  },
                });
              }}
            />
            <ToggleRow
              label="Capture network failures"
              checked={settings.capture.captureNetworkFailures}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  capture: {
                    ...settings.capture,
                    captureNetworkFailures: checked,
                  },
                });
              }}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Issue notifications"
          description="Browser notifications appear only for new unique UI, Console, or Network issues while capture is recording."
        >
          <div className="flex flex-col gap-3">
            <ToggleRow
              label="Show notifications for new issues"
              checked={settings.notifications.enabled}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    enabled: checked,
                  },
                });
              }}
            />
            <ToggleRow
              label="UI issue notifications"
              checked={settings.notifications.uiIssues}
              disabled={!settings.notifications.enabled}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    uiIssues: checked,
                  },
                });
              }}
            />
            <ToggleRow
              label="Console issue notifications"
              checked={settings.notifications.consoleIssues}
              disabled={!settings.notifications.enabled}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    consoleIssues: checked,
                  },
                });
              }}
            />
            <ToggleRow
              label="Network issue notifications"
              checked={settings.notifications.networkIssues}
              disabled={!settings.notifications.enabled}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    networkIssues: checked,
                  },
                });
              }}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Screenshot evidence"
          description="UI issues are captured automatically. Console and Network screenshots are optional because technical issues may not have a visible page effect. Visible viewport only; stored locally. Settings apply to new issues immediately."
        >
          <div className="flex flex-col gap-3">
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
              Review screenshots before exporting or sending session data.
            </p>
            <ToggleRow
              label="Capture screenshots automatically"
              checked={settings.screenshots.captureAutomatically}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  screenshots: {
                    ...settings.screenshots,
                    captureAutomatically: checked,
                  },
                });
              }}
            />
            <ToggleRow
              label="UI issues"
              checked={settings.screenshots.uiIssues}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  screenshots: {
                    ...settings.screenshots,
                    uiIssues: checked,
                  },
                });
              }}
            />
            <ToggleRow
              label="Console issues"
              checked={settings.screenshots.consoleIssues}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  screenshots: {
                    ...settings.screenshots,
                    consoleIssues: checked,
                  },
                });
              }}
            />
            <ToggleRow
              label="Network issues"
              checked={settings.screenshots.networkIssues}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  screenshots: {
                    ...settings.screenshots,
                    networkIssues: checked,
                  },
                });
              }}
            />
            <ScreenshotLimitField
              label="Maximum screenshots per session"
              value={settings.screenshots.maxPerSession}
              error={errors.maxScreenshotsPerSession}
              onChange={(value) => {
                void persist({
                  ...settings,
                  screenshots: {
                    ...settings.screenshots,
                    maxPerSession: value,
                  },
                });
              }}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Privacy"
          description="These controls match the redaction rules enforced during capture."
        >
          <div className="flex flex-col gap-3">
            <ToggleRow
              label="Redact sensitive URL parameters"
              checked={settings.privacy.redactSensitiveUrlParameters}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  privacy: {
                    ...settings.privacy,
                    redactSensitiveUrlParameters: checked,
                  },
                });
              }}
            />
            <ToggleRow
              label="Remove URL hash"
              checked={settings.privacy.removeUrlHash}
              onChange={(checked) => {
                void persist({
                  ...settings,
                  privacy: { ...settings.privacy, removeUrlHash: checked },
                });
              }}
            />
            <ToggleRow
              label="Never store text field values"
              checked
              disabled
              onChange={() => undefined}
            />
            <ToggleRow
              label="Protect password and private fields"
              checked
              disabled
              onChange={() => undefined}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Bug ticket prompt"
          description="Optional extra instructions are added to Generate prompt. Built-in evidence-only rules still apply. Leave empty to use the default."
        >
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-800 dark:text-slate-100">
                Extra instructions
              </span>
              <textarea
                aria-label="Extra instructions"
                rows={6}
                maxLength={4000}
                value={settings.prompt.extraInstructions}
                className="rounded border border-slate-300 px-2 py-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-900"
                onChange={(event) => {
                  persistPromptInstructions(event.target.value);
                }}
              />
              {errors.promptExtraInstructions !== undefined ? (
                <span
                  role="alert"
                  className="text-xs text-red-700 dark:text-red-300"
                >
                  {errors.promptExtraInstructions}
                </span>
              ) : null}
            </label>
            <button
              type="button"
              className="self-start text-sm text-teal-800 underline dark:text-teal-300"
              onClick={() => {
                void persist({
                  ...settings,
                  prompt: { extraInstructions: '' },
                });
              }}
            >
              Reset to default
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Limits"
          description="Updated limits apply to new capture sessions only."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <LimitField
              label="Maximum Actions per session"
              value={settings.limits.maxActionsPerSession}
              error={errors.maxActionsPerSession}
              onChange={(value) => {
                void persist({
                  ...settings,
                  limits: { ...settings.limits, maxActionsPerSession: value },
                });
              }}
            />
            <LimitField
              label="Maximum unique UI issues"
              value={settings.limits.maxUniqueUiIssues}
              error={errors.maxUniqueUiIssues}
              onChange={(value) => {
                void persist({
                  ...settings,
                  limits: { ...settings.limits, maxUniqueUiIssues: value },
                });
              }}
            />
            <LimitField
              label="Maximum unique Console issues"
              value={settings.limits.maxUniqueConsoleIssues}
              error={errors.maxUniqueConsoleIssues}
              onChange={(value) => {
                void persist({
                  ...settings,
                  limits: {
                    ...settings.limits,
                    maxUniqueConsoleIssues: value,
                  },
                });
              }}
            />
            <LimitField
              label="Maximum unique Network issues"
              value={settings.limits.maxUniqueNetworkIssues}
              error={errors.maxUniqueNetworkIssues}
              onChange={(value) => {
                void persist({
                  ...settings,
                  limits: {
                    ...settings.limits,
                    maxUniqueNetworkIssues: value,
                  },
                });
              }}
            />
          </div>
        </SectionCard>

        <CollapsibleSection
          title="Advanced UI issue rules"
          description="Use custom CSS selectors when your application has project-specific error elements."
          defaultOpen={false}
        >
          <UiIssueRulesPanel />
        </CollapsibleSection>
      </div>
    </main>
  );
}
