export const SIDE_PANEL_UNSUPPORTED_MESSAGE =
  'Side panel is not supported in this browser.';

export const SIDE_PANEL_OPEN_FAILED_MESSAGE = 'Could not open the side panel.';

export const SETTINGS_UNSUPPORTED_MESSAGE =
  'Settings are not supported in this browser.';

export const SETTINGS_OPEN_FAILED_MESSAGE = 'Could not open settings.';

export const WINDOW_UNAVAILABLE_MESSAGE =
  'The current window could not be determined.';

const KNOWN_MESSAGES = new Set<string>([
  SIDE_PANEL_UNSUPPORTED_MESSAGE,
  SIDE_PANEL_OPEN_FAILED_MESSAGE,
  SETTINGS_UNSUPPORTED_MESSAGE,
  SETTINGS_OPEN_FAILED_MESSAGE,
  WINDOW_UNAVAILABLE_MESSAGE,
]);

export function toInlineError(error: unknown, fallback: string): string {
  if (error instanceof Error && KNOWN_MESSAGES.has(error.message)) {
    return error.message;
  }

  return fallback;
}
