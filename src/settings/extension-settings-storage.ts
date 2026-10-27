import {
  DEFAULT_EXTENSION_SETTINGS,
  EXTENSION_SETTINGS_STORAGE_KEY,
  type ExtensionSettings,
  parseExtensionSettings,
} from '@/src/settings/extension-settings';
import { browser } from 'wxt/browser';

export async function readExtensionSettingsFromStorage(): Promise<ExtensionSettings> {
  try {
    const stored = await browser.storage.local.get(
      EXTENSION_SETTINGS_STORAGE_KEY,
    );
    return parseExtensionSettings(stored[EXTENSION_SETTINGS_STORAGE_KEY]);
  } catch {
    return DEFAULT_EXTENSION_SETTINGS;
  }
}

export async function writeExtensionSettingsToStorage(
  settings: ExtensionSettings,
): Promise<void> {
  await browser.storage.local.set({
    [EXTENSION_SETTINGS_STORAGE_KEY]: settings,
  });
}
