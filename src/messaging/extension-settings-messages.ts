import type { ExtensionSettings } from '@/src/settings/extension-settings';

export const GET_EXTENSION_SETTINGS = 'GET_EXTENSION_SETTINGS' as const;
export const EXTENSION_SETTINGS_UPDATED = 'EXTENSION_SETTINGS_UPDATED' as const;

export type GetExtensionSettingsMessage = {
  type: typeof GET_EXTENSION_SETTINGS;
};

export type ExtensionSettingsUpdatedMessage = {
  type: typeof EXTENSION_SETTINGS_UPDATED;
  settings: ExtensionSettings;
};

export function isGetExtensionSettingsMessage(
  message: unknown,
): message is GetExtensionSettingsMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === GET_EXTENSION_SETTINGS
  );
}

export function isExtensionSettingsUpdatedMessage(
  message: unknown,
): message is ExtensionSettingsUpdatedMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === EXTENSION_SETTINGS_UPDATED &&
    'settings' in message
  );
}
