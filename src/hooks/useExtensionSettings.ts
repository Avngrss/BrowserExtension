import { useEffect, useState } from 'react';
import {
  DEFAULT_EXTENSION_SETTINGS,
  EXTENSION_SETTINGS_STORAGE_KEY,
  parseExtensionSettings,
  type ExtensionSettings,
} from '@/src/settings/extension-settings';
import { readExtensionSettingsFromStorage } from '@/src/settings/extension-settings-storage';
import { browser } from 'wxt/browser';

export function useExtensionSettings(): ExtensionSettings {
  const [settings, setSettings] = useState<ExtensionSettings>(
    DEFAULT_EXTENSION_SETTINGS,
  );

  useEffect(() => {
    let cancelled = false;
    void readExtensionSettingsFromStorage().then((next) => {
      if (!cancelled) {
        setSettings(next);
      }
    });

    const onChanged: Parameters<
      typeof browser.storage.onChanged.addListener
    >[0] = (changes, areaName) => {
      if (areaName !== 'local') {
        return;
      }
      const change = changes[EXTENSION_SETTINGS_STORAGE_KEY];
      if (change === undefined) {
        return;
      }
      setSettings(parseExtensionSettings(change.newValue));
    };

    browser.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return settings;
}
