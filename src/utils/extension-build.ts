import { browser } from 'wxt/browser';

export function readExtensionBuildVersion(): string {
  try {
    return browser.runtime.getManifest().version;
  } catch {
    return 'unknown';
  }
}

export function readExtensionRuntimeId(): string {
  try {
    return browser.runtime.id;
  } catch {
    return '';
  }
}
