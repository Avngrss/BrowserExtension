export const EXTENSION_SETTINGS_STORAGE_KEY = 'extensionSettings.v1';

export type CaptureCollectorSettings = {
  captureActions: boolean;
  captureUiIssues: boolean;
  captureConsoleErrors: boolean;
  captureNetworkFailures: boolean;
};

export type PrivacySettings = {
  redactSensitiveUrlParameters: boolean;
  removeUrlHash: boolean;
  neverStoreTextFieldValues: boolean;
  protectPasswordAndPrivateFields: boolean;
};

export type SessionLimitSettings = {
  maxActionsPerSession: number;
  maxUniqueUiIssues: number;
  maxUniqueConsoleIssues: number;
  maxUniqueNetworkIssues: number;
};

export type ScreenshotEvidenceSettings = {
  captureAutomatically: boolean;
  uiIssues: boolean;
  consoleIssues: boolean;
  networkIssues: boolean;
  maxPerSession: number;
};

export type IssueNotificationSettings = {
  enabled: boolean;
  uiIssues: boolean;
  consoleIssues: boolean;
  networkIssues: boolean;
};

export type ExtensionSettings = {
  capture: CaptureCollectorSettings;
  privacy: PrivacySettings;
  limits: SessionLimitSettings;
  screenshots: ScreenshotEvidenceSettings;
  notifications: IssueNotificationSettings;
};

export const DEFAULT_CAPTURE_COLLECTOR_SETTINGS: CaptureCollectorSettings = {
  captureActions: true,
  captureUiIssues: true,
  captureConsoleErrors: true,
  captureNetworkFailures: true,
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  redactSensitiveUrlParameters: true,
  removeUrlHash: true,
  neverStoreTextFieldValues: true,
  protectPasswordAndPrivateFields: true,
};

export const DEFAULT_SESSION_LIMIT_SETTINGS: SessionLimitSettings = {
  maxActionsPerSession: 100,
  maxUniqueUiIssues: 100,
  maxUniqueConsoleIssues: 100,
  maxUniqueNetworkIssues: 100,
};

export const DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS: ScreenshotEvidenceSettings =
  {
    captureAutomatically: true,
    uiIssues: true,
    consoleIssues: false,
    networkIssues: false,
    maxPerSession: 10,
  };

export const DEFAULT_ISSUE_NOTIFICATION_SETTINGS: IssueNotificationSettings = {
  enabled: true,
  uiIssues: true,
  consoleIssues: true,
  networkIssues: true,
};

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  capture: DEFAULT_CAPTURE_COLLECTOR_SETTINGS,
  privacy: DEFAULT_PRIVACY_SETTINGS,
  limits: DEFAULT_SESSION_LIMIT_SETTINGS,
  screenshots: DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS,
  notifications: DEFAULT_ISSUE_NOTIFICATION_SETTINGS,
};

export const LIMIT_MIN = 10;
export const LIMIT_MAX = 1000;
export const SCREENSHOT_MAX_MIN = 1;
export const SCREENSHOT_MAX_LIMIT = 50;

export type SettingsFieldErrors = Partial<
  Record<
    | 'maxActionsPerSession'
    | 'maxUniqueUiIssues'
    | 'maxUniqueConsoleIssues'
    | 'maxUniqueNetworkIssues'
    | 'maxScreenshotsPerSession',
    string
  >
>;

export function validateScreenshotMaxPerSession(
  value: number,
): string | undefined {
  if (!Number.isInteger(value)) {
    return 'Maximum screenshots per session must be a whole number.';
  }
  if (value < SCREENSHOT_MAX_MIN || value > SCREENSHOT_MAX_LIMIT) {
    return `Maximum screenshots per session must be between ${SCREENSHOT_MAX_MIN} and ${SCREENSHOT_MAX_LIMIT}.`;
  }
  return undefined;
}

export function validateSessionLimit(
  value: number,
  label: string,
): string | undefined {
  if (!Number.isInteger(value)) {
    return `${label} must be a whole number.`;
  }
  if (value < LIMIT_MIN || value > LIMIT_MAX) {
    return `${label} must be between ${LIMIT_MIN} and ${LIMIT_MAX}.`;
  }
  return undefined;
}

export function validateExtensionSettings(
  value: ExtensionSettings,
): SettingsFieldErrors {
  const errors: SettingsFieldErrors = {};
  const limits = value.limits;
  const checks: Array<[keyof SessionLimitSettings, string]> = [
    ['maxActionsPerSession', 'Maximum Actions per session'],
    ['maxUniqueUiIssues', 'Maximum unique UI issues'],
    ['maxUniqueConsoleIssues', 'Maximum unique Console issues'],
    ['maxUniqueNetworkIssues', 'Maximum unique Network issues'],
  ];
  for (const [key, label] of checks) {
    const message = validateSessionLimit(limits[key], label);
    if (message !== undefined) {
      errors[key] = message;
    }
  }
  const screenshotMax = validateScreenshotMaxPerSession(
    value.screenshots.maxPerSession,
  );
  if (screenshotMax !== undefined) {
    errors.maxScreenshotsPerSession = screenshotMax;
  }
  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseLimit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? value
    : fallback;
}

export function parseExtensionSettings(raw: unknown): ExtensionSettings {
  if (!isRecord(raw)) {
    return DEFAULT_EXTENSION_SETTINGS;
  }

  const captureRaw = isRecord(raw.capture) ? raw.capture : {};
  const privacyRaw = isRecord(raw.privacy) ? raw.privacy : {};
  const limitsRaw = isRecord(raw.limits) ? raw.limits : {};
  const screenshotsRaw = isRecord(raw.screenshots) ? raw.screenshots : {};
  const notificationsRaw = isRecord(raw.notifications) ? raw.notifications : {};

  const settings: ExtensionSettings = {
    capture: {
      captureActions: parseBoolean(
        captureRaw.captureActions,
        DEFAULT_CAPTURE_COLLECTOR_SETTINGS.captureActions,
      ),
      captureUiIssues: parseBoolean(
        captureRaw.captureUiIssues,
        DEFAULT_CAPTURE_COLLECTOR_SETTINGS.captureUiIssues,
      ),
      captureConsoleErrors: parseBoolean(
        captureRaw.captureConsoleErrors,
        DEFAULT_CAPTURE_COLLECTOR_SETTINGS.captureConsoleErrors,
      ),
      captureNetworkFailures: parseBoolean(
        captureRaw.captureNetworkFailures,
        DEFAULT_CAPTURE_COLLECTOR_SETTINGS.captureNetworkFailures,
      ),
    },
    privacy: {
      redactSensitiveUrlParameters: parseBoolean(
        privacyRaw.redactSensitiveUrlParameters,
        DEFAULT_PRIVACY_SETTINGS.redactSensitiveUrlParameters,
      ),
      removeUrlHash: parseBoolean(
        privacyRaw.removeUrlHash,
        DEFAULT_PRIVACY_SETTINGS.removeUrlHash,
      ),
      neverStoreTextFieldValues: true,
      protectPasswordAndPrivateFields: true,
    },
    limits: {
      maxActionsPerSession: parseLimit(
        limitsRaw.maxActionsPerSession,
        DEFAULT_SESSION_LIMIT_SETTINGS.maxActionsPerSession,
      ),
      maxUniqueUiIssues: parseLimit(
        limitsRaw.maxUniqueUiIssues,
        DEFAULT_SESSION_LIMIT_SETTINGS.maxUniqueUiIssues,
      ),
      maxUniqueConsoleIssues: parseLimit(
        limitsRaw.maxUniqueConsoleIssues,
        DEFAULT_SESSION_LIMIT_SETTINGS.maxUniqueConsoleIssues,
      ),
      maxUniqueNetworkIssues: parseLimit(
        limitsRaw.maxUniqueNetworkIssues,
        DEFAULT_SESSION_LIMIT_SETTINGS.maxUniqueNetworkIssues,
      ),
    },
    screenshots: {
      captureAutomatically: parseBoolean(
        screenshotsRaw.captureAutomatically,
        DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS.captureAutomatically,
      ),
      uiIssues: parseBoolean(
        screenshotsRaw.uiIssues,
        DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS.uiIssues,
      ),
      consoleIssues: parseBoolean(
        screenshotsRaw.consoleIssues,
        DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS.consoleIssues,
      ),
      networkIssues: parseBoolean(
        screenshotsRaw.networkIssues,
        DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS.networkIssues,
      ),
      maxPerSession: parseLimit(
        screenshotsRaw.maxPerSession,
        DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS.maxPerSession,
      ),
    },
    notifications: {
      enabled: parseBoolean(
        notificationsRaw.enabled,
        DEFAULT_ISSUE_NOTIFICATION_SETTINGS.enabled,
      ),
      uiIssues: parseBoolean(
        notificationsRaw.uiIssues,
        DEFAULT_ISSUE_NOTIFICATION_SETTINGS.uiIssues,
      ),
      consoleIssues: parseBoolean(
        notificationsRaw.consoleIssues,
        DEFAULT_ISSUE_NOTIFICATION_SETTINGS.consoleIssues,
      ),
      networkIssues: parseBoolean(
        notificationsRaw.networkIssues,
        DEFAULT_ISSUE_NOTIFICATION_SETTINGS.networkIssues,
      ),
    },
  };

  const errors = validateExtensionSettings(settings);
  if (Object.keys(errors).length > 0) {
    return DEFAULT_EXTENSION_SETTINGS;
  }

  return settings;
}
