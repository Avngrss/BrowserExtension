const SENSITIVE_AUTOCOMPLETE = new Set([
  'current-password',
  'new-password',
  'one-time-code',
]);

export function isSensitiveElement(element: Element): boolean {
  if (element.closest('[data-private]') !== null) {
    return true;
  }

  if (element.hasAttribute('data-private')) {
    return true;
  }

  if (element instanceof HTMLInputElement) {
    if (element.type.toLowerCase() === 'password') {
      return true;
    }
    const autocomplete = element.getAttribute('autocomplete')?.toLowerCase();
    if (
      autocomplete !== undefined &&
      SENSITIVE_AUTOCOMPLETE.has(autocomplete)
    ) {
      return true;
    }
  }

  return false;
}
