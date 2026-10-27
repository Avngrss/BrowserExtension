import type { SafeElementDescriptor } from '@/src/domain/action';
import { inferSemanticElementType } from '@/src/capture/element-semantic';
import { isSensitiveElement } from '@/src/privacy/sensitive-element';
import { truncateCapturedText } from '@/src/privacy/text-sanitizer';

function readTestId(element: Element): string | undefined {
  for (const attribute of ['data-testid', 'data-test', 'data-qa'] as const) {
    const value = element.getAttribute(attribute);
    if (value !== null && value.length > 0) {
      return truncateCapturedText(value);
    }
  }
  return undefined;
}

function readAccessibleName(element: Element): string | undefined {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel !== null) {
    return truncateCapturedText(ariaLabel);
  }

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy !== null) {
    const labelText = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');
    const normalized = truncateCapturedText(labelText);
    if (normalized !== undefined) {
      return normalized;
    }
  }

  const associatedLabel = readAssociatedLabelText(element);
  if (associatedLabel !== undefined) {
    return associatedLabel;
  }

  if (element instanceof HTMLSelectElement) {
    const title = element.getAttribute('title');
    if (title !== null) {
      return truncateCapturedText(title);
    }
    return undefined;
  }

  if (
    element instanceof HTMLButtonElement ||
    element instanceof HTMLAnchorElement
  ) {
    return truncateCapturedText(element.textContent ?? '');
  }

  const title = element.getAttribute('title');
  if (title !== null) {
    return truncateCapturedText(title);
  }

  return undefined;
}

function readAssociatedLabelText(element: Element): string | undefined {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const labelled = element.labels?.[0]?.textContent ?? '';
    return truncateCapturedText(labelled);
  }

  return undefined;
}

function readVisibleText(element: Element): string | undefined {
  if (isSensitiveElement(element)) {
    return undefined;
  }

  if (element instanceof HTMLSelectElement) {
    return undefined;
  }

  const text = element.textContent ?? '';
  return truncateCapturedText(text);
}

export function buildSafeElementDescriptor(
  element: Element,
): SafeElementDescriptor {
  const sensitive = isSensitiveElement(element);
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute('role') ?? undefined;
  const inputType =
    element instanceof HTMLInputElement ? element.type : undefined;
  const hasHref =
    element instanceof HTMLAnchorElement
      ? element.hasAttribute('href')
      : undefined;

  const descriptor: SafeElementDescriptor = {
    tagName,
    semanticType: inferSemanticElementType(tagName, {
      role: role ?? undefined,
      inputType,
      hasHref,
    }),
  };

  if (role !== undefined && role.length > 0) {
    descriptor.role = role;
  }

  const testId = readTestId(element);
  if (testId !== undefined) {
    descriptor.testId = testId;
  }

  if (inputType !== undefined) {
    descriptor.inputType = inputType;
  }

  if (!sensitive) {
    const accessibleName = readAccessibleName(element);
    if (accessibleName !== undefined) {
      descriptor.accessibleName = accessibleName;
    }

    const visibleText = readVisibleText(element);
    if (visibleText !== undefined) {
      descriptor.visibleText = visibleText;
    }
  }

  return descriptor;
}
