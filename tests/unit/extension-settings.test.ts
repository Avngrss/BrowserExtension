import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXTENSION_SETTINGS,
  parseExtensionSettings,
  validateExtensionSettings,
} from '@/src/settings/extension-settings';

describe('extension settings', () => {
  it('defaults collectors to enabled', () => {
    expect(parseExtensionSettings(undefined)).toEqual(
      DEFAULT_EXTENSION_SETTINGS,
    );
  });

  it('rejects invalid limits', () => {
    const errors = validateExtensionSettings({
      ...DEFAULT_EXTENSION_SETTINGS,
      limits: {
        ...DEFAULT_EXTENSION_SETTINGS.limits,
        maxActionsPerSession: 5,
      },
    });
    expect(errors.maxActionsPerSession).toBeTruthy();
  });

  it('defaults screenshot evidence settings', () => {
    expect(DEFAULT_EXTENSION_SETTINGS.screenshots).toEqual({
      captureAutomatically: true,
      uiIssues: true,
      consoleIssues: false,
      networkIssues: false,
      maxPerSession: 10,
    });
    expect(
      validateExtensionSettings(DEFAULT_EXTENSION_SETTINGS)
        .maxScreenshotsPerSession,
    ).toBeUndefined();
  });

  it('preserves saved screenshot category toggles when parsing storage', () => {
    const parsed = parseExtensionSettings({
      ...DEFAULT_EXTENSION_SETTINGS,
      screenshots: {
        captureAutomatically: true,
        uiIssues: false,
        consoleIssues: true,
        networkIssues: true,
        maxPerSession: 5,
      },
    });
    expect(parsed.screenshots.uiIssues).toBe(false);
    expect(parsed.screenshots.consoleIssues).toBe(true);
    expect(parsed.screenshots.networkIssues).toBe(true);
    expect(parsed.screenshots.maxPerSession).toBe(5);
  });

  it('defaults extra prompt instructions to empty', () => {
    expect(DEFAULT_EXTENSION_SETTINGS.prompt).toEqual({
      extraInstructions: '',
    });
    expect(
      parseExtensionSettings({
        capture: DEFAULT_EXTENSION_SETTINGS.capture,
      }).prompt.extraInstructions,
    ).toBe('');
  });

  it('preserves extra prompt instructions when parsing storage', () => {
    const parsed = parseExtensionSettings({
      ...DEFAULT_EXTENSION_SETTINGS,
      prompt: { extraInstructions: 'Write the ticket in Russian.' },
    });
    expect(parsed.prompt.extraInstructions).toBe(
      'Write the ticket in Russian.',
    );
  });

  it('uses new category defaults only for missing screenshot fields', () => {
    const parsed = parseExtensionSettings({
      ...DEFAULT_EXTENSION_SETTINGS,
      screenshots: {
        consoleIssues: true,
      },
    });
    expect(parsed.screenshots.uiIssues).toBe(true);
    expect(parsed.screenshots.consoleIssues).toBe(true);
    expect(parsed.screenshots.networkIssues).toBe(false);
  });
});
