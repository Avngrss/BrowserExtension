import {
  sanitizeUrl,
  type SanitizeUrlOptions,
} from '@/src/privacy/url-sanitizer';
import type { PrivacySettings } from '@/src/settings/extension-settings';

let runtimeOptions: SanitizeUrlOptions = {
  redactSensitiveUrlParameters: true,
  removeUrlHash: true,
};

export function applyUrlSanitizeSettings(privacy: PrivacySettings): void {
  runtimeOptions = {
    redactSensitiveUrlParameters: privacy.redactSensitiveUrlParameters,
    removeUrlHash: privacy.removeUrlHash,
  };
}

export function sanitizeUrlForCapture(rawUrl: string): string | null {
  return sanitizeUrl(rawUrl, runtimeOptions);
}
