const MAX_CAPTURED_TEXT_LENGTH = 200;

export function normalizeCapturedText(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_CAPTURED_TEXT_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_CAPTURED_TEXT_LENGTH - 1)}…`;
}

export function truncateCapturedText(
  value: string | undefined,
): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  return normalizeCapturedText(value);
}
