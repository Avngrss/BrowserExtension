import {
  DEFAULT_EXTENSION_SETTINGS,
  type ExtensionSettings,
} from '@/src/settings/extension-settings';
import { readExtensionSettingsFromStorage } from '@/src/settings/extension-settings-storage';

export class ExtensionSettingsService {
  private settings: ExtensionSettings = DEFAULT_EXTENSION_SETTINGS;
  private ready: Promise<void>;

  constructor() {
    this.ready = this.reload();
  }

  waitUntilReady(): Promise<void> {
    return this.ready;
  }

  async reload(): Promise<void> {
    this.settings = await readExtensionSettingsFromStorage();
  }

  getSettings(): ExtensionSettings {
    return this.settings;
  }

  getLimits() {
    return this.settings.limits;
  }

  getCaptureCollectors() {
    return this.settings.capture;
  }

  getPrivacy() {
    return this.settings.privacy;
  }

  getScreenshotSettings() {
    return this.settings.screenshots;
  }

  getNotificationSettings() {
    return this.settings.notifications;
  }
}
