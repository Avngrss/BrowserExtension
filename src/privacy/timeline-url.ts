/** Compact path for timeline UI and tickets from an already-sanitized URL. */

const MAX_DISPLAY_PATH = 80;
const MAX_QUERY_DISPLAY = 48;
const OPAQUE_ID_MIN_LENGTH = 16;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const HEX_ID_PATTERN = /^[0-9a-f]{16,}$/i;

export function looksLikeOpaqueId(segment: string): boolean {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    decoded = segment;
  }
  if (decoded.length < 12) {
    return false;
  }
  if (UUID_PATTERN.test(decoded) || ULID_PATTERN.test(decoded)) {
    return true;
  }
  if (HEX_ID_PATTERN.test(decoded)) {
    return true;
  }
  return (
    decoded.length >= OPAQUE_ID_MIN_LENGTH &&
    /^[0-9A-Za-z]+$/.test(decoded) &&
    /\d/.test(decoded) &&
    /[A-Za-z]/.test(decoded)
  );
}

export function collapseDuplicatedPathSegment(pathname: string): string {
  const parts = pathname.split('/');
  const last = parts.at(-1);
  if (last === undefined || last.length < 16 || last.length % 2 !== 0) {
    return pathname;
  }
  const half = last.length / 2;
  const first = last.slice(0, half);
  const second = last.slice(half);
  if (first === second && looksLikeOpaqueId(first)) {
    parts[parts.length - 1] = first;
    return parts.join('/');
  }
  return pathname;
}

function compactSearch(search: string): string {
  if (search.length === 0 || search.length > MAX_QUERY_DISPLAY) {
    return '';
  }
  return search;
}

function truncateDisplay(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

export function formatActionTimelinePath(sanitizedUrl: string): string {
  try {
    const parsed = new URL(sanitizedUrl);
    const pathname = collapseDuplicatedPathSegment(
      parsed.pathname.length > 0 ? parsed.pathname : '/',
    );
    const combined = `${pathname}${compactSearch(parsed.search)}`;
    if (combined.length <= MAX_DISPLAY_PATH) {
      return combined;
    }
    return truncateDisplay(pathname, MAX_DISPLAY_PATH);
  } catch {
    return truncateDisplay(sanitizedUrl, MAX_DISPLAY_PATH);
  }
}

export function formatTicketEnvironmentUrl(sanitizedUrl: string): string {
  try {
    const parsed = new URL(sanitizedUrl);
    const pathname = collapseDuplicatedPathSegment(
      parsed.pathname.length > 0 ? parsed.pathname : '/',
    );
    return `${parsed.origin}${pathname}`;
  } catch {
    return truncateDisplay(sanitizedUrl, 120);
  }
}
