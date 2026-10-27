const REDACTED_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'password',
  'secret',
  'session',
  'session_id',
]);

export type SanitizeUrlOptions = {
  redactSensitiveUrlParameters?: boolean;
  removeUrlHash?: boolean;
};

export function sanitizeUrl(
  rawUrl: string,
  options: SanitizeUrlOptions = {},
): string | null {
  const redactSensitive = options.redactSensitiveUrlParameters ?? true;
  const removeHash = options.removeUrlHash ?? true;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    if (url.username || url.password) {
      url.username = '';
      url.password = '';
    }

    if (removeHash) {
      url.hash = '';
    }

    if (redactSensitive) {
      for (const key of [...url.searchParams.keys()]) {
        if (REDACTED_QUERY_KEYS.has(key.toLowerCase())) {
          url.searchParams.set(key, '[redacted]');
        }
      }
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function isSupportedHttpUrl(rawUrl: string): boolean {
  return sanitizeUrl(rawUrl) !== null;
}
