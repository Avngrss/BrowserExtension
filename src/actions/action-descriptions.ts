import type { CapturedAction } from '@/src/domain/action';
import { getSemanticElementType } from '@/src/capture/element-semantic';

function isRedactedFieldAction(action: CapturedAction): boolean {
  return (
    (action.type === 'input' || action.type === 'change') &&
    action.redacted === true
  );
}

function elementName(action: CapturedAction): string | undefined {
  if (action.type === 'navigation') {
    return undefined;
  }

  const element = action.element;
  const elementType = getSemanticElementType(element);
  const redacted = isRedactedFieldAction(action);

  if (elementType === 'combobox') {
    return (
      element.accessibleName ??
      (redacted ? undefined : element.testId) ??
      undefined
    );
  }

  if (redacted) {
    return element.accessibleName ?? undefined;
  }

  return (
    element.accessibleName ?? element.visibleText ?? element.testId ?? undefined
  );
}

export function describeCapturedAction(action: CapturedAction): string {
  if (action.type === 'navigation') {
    return 'Navigated';
  }

  const elementType = getSemanticElementType(action.element);
  const name = elementName(action);

  if (action.type === 'submit') {
    return name !== undefined ? `Submitted form “${name}”` : 'Submitted form';
  }

  if (action.type === 'input') {
    if (name !== undefined) {
      return `Entered value into ${elementType} “${name}”`;
    }
    return `Entered value into ${elementType}`;
  }

  if (action.type === 'change') {
    if (elementType === 'combobox') {
      return name !== undefined
        ? `Selected option in ${elementType} “${name}”`
        : `Selected option in ${elementType}`;
    }

    if (elementType === 'checkbox') {
      return name !== undefined
        ? `Changed ${elementType} “${name}”`
        : `Changed ${elementType}`;
    }

    if (elementType === 'radio') {
      return name !== undefined
        ? `Selected ${elementType} “${name}”`
        : `Selected ${elementType}`;
    }

    if (action.element.inputType === 'file') {
      return name !== undefined
        ? `Selected file in file input “${name}”`
        : 'Selected file in file input';
    }

    return name !== undefined
      ? `Changed ${elementType} “${name}”`
      : `Changed ${elementType}`;
  }

  if (name !== undefined) {
    return `Clicked ${elementType} “${name}”`;
  }

  return `Clicked ${elementType}`;
}
