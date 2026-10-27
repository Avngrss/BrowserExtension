/** Compact path for timeline UI from an already-sanitized action URL. */
export function formatActionTimelinePath(sanitizedUrl: string): string {
  try {
    const parsed = new URL(sanitizedUrl);
    const pathname = parsed.pathname.length > 0 ? parsed.pathname : '/';
    return `${pathname}${parsed.search}`;
  } catch {
    return sanitizedUrl;
  }
}
