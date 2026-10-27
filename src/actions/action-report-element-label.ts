import type { CapturedAction } from '@/src/domain/action';
import type { SafeElementDescriptor } from '@/src/domain/action';
import {
  getSemanticElementType,
  getUserFacingElementKind,
} from '@/src/capture/element-semantic';

function isRedactedFieldAction(action: CapturedAction): boolean {
  return (
    (action.type === 'input' || action.type === 'change') &&
    action.redacted === true
  );
}

export function resolveActionElementLabel(
  action: CapturedAction,
): string | undefined {
  if (action.type === 'navigation' || action.type === 'submit') {
    return undefined;
  }
  const element = action.element;
  if (isRedactedFieldAction(action)) {
    return element.accessibleName?.trim() || undefined;
  }
  const visible = element.visibleText?.trim();
  if (visible !== undefined && visible.length > 0) {
    return visible;
  }
  const accessible = element.accessibleName?.trim();
  if (accessible !== undefined && accessible.length > 0) {
    return accessible;
  }
  return undefined;
}

export function describeClickWithoutLabel(
  descriptor: SafeElementDescriptor,
): string {
  const kind = getUserFacingElementKind(descriptor);
  switch (kind) {
    case 'link':
      return 'Clicked a link.';
    case 'button':
      return 'Clicked a button.';
    case 'textbox':
      return 'Clicked a text field.';
    case 'checkbox':
      return 'Clicked a checkbox.';
    case 'radio':
      return 'Clicked a radio button.';
    case 'combobox':
      return 'Clicked a dropdown.';
    default:
      return 'Clicked a control.';
  }
}

export function describeElementKindForField(
  descriptor: SafeElementDescriptor,
): string {
  return getUserFacingElementKind(descriptor);
}

export function resolveSemanticElementType(
  descriptor: SafeElementDescriptor,
): string {
  return getSemanticElementType(descriptor);
}
