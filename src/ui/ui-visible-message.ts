import { isSensitiveElement } from '@/src/privacy/sensitive-element';
import { MAX_UI_VISIBLE_MESSAGE_LENGTH } from '@/src/ui/ui-issue-limits';

function truncateUiMessage(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_UI_VISIBLE_MESSAGE_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_UI_VISIBLE_MESSAGE_LENGTH - 1)}…`;
}

export function readUiVisibleMessage(element: Element): string | undefined {
  if (isSensitiveElement(element)) {
    return undefined;
  }

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel !== null && ariaLabel.trim().length > 0) {
    return truncateUiMessage(ariaLabel);
  }

  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (text.length === 0) {
    return undefined;
  }

  return truncateUiMessage(text);
}

export function normalizeUiMessageForFingerprint(
  message: string | undefined,
): string {
  if (message === undefined) {
    return '';
  }
  return message.replace(/\s+/g, ' ').trim();
}
