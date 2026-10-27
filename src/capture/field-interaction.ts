import type {
  ChangeCapturedAction,
  InputCapturedAction,
} from '@/src/domain/action';
import { buildSafeElementDescriptor } from '@/src/capture/element-descriptor';
import { getSemanticElementType } from '@/src/capture/element-semantic';
import { isSensitiveElement } from '@/src/privacy/sensitive-element';

const TEXT_LIKE_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'tel',
  'url',
  'number',
  'password',
]);

export function isFieldDisabled(element: Element): boolean {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLButtonElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    if (element.disabled) {
      return true;
    }
  }

  return element.closest('fieldset[disabled]') !== null;
}

export function isTextLikeField(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement) {
    return true;
  }

  if (element instanceof HTMLInputElement) {
    return TEXT_LIKE_INPUT_TYPES.has(element.type.toLowerCase());
  }

  return false;
}

export function isChangeInteractionField(element: Element): boolean {
  if (element instanceof HTMLSelectElement) {
    return true;
  }

  if (element instanceof HTMLInputElement) {
    const inputType = element.type.toLowerCase();
    return (
      inputType === 'checkbox' ||
      inputType === 'radio' ||
      inputType === 'date' ||
      inputType === 'file' ||
      inputType === 'range' ||
      inputType === 'color'
    );
  }

  return false;
}

function readCheckedState(element: Element): boolean | undefined {
  if (!(element instanceof HTMLInputElement)) {
    return undefined;
  }

  const semanticType = getSemanticElementType(
    buildSafeElementDescriptor(element),
  );
  if (semanticType !== 'checkbox' && semanticType !== 'radio') {
    return undefined;
  }

  return element.checked;
}

export type InputFieldPartial = Pick<
  InputCapturedAction,
  'type' | 'element' | 'redacted'
>;
export type ChangeFieldPartial = Pick<
  ChangeCapturedAction,
  'type' | 'element' | 'redacted' | 'checked'
>;

export function buildFieldActionPartial(
  element: Element,
  actionType: 'input' | 'change',
): InputFieldPartial | ChangeFieldPartial | null {
  if (isFieldDisabled(element)) {
    return null;
  }

  const redacted = isSensitiveElement(element);
  const elementDescriptor = buildSafeElementDescriptor(element);

  if (actionType === 'input') {
    const payload: InputFieldPartial = {
      type: 'input',
      element: elementDescriptor,
      ...(redacted ? { redacted: true as const } : {}),
    };
    return payload;
  }

  const checked = readCheckedState(element);
  const payload: ChangeFieldPartial = {
    type: 'change',
    element: elementDescriptor,
    ...(redacted ? { redacted: true as const } : {}),
    ...(checked !== undefined ? { checked } : {}),
  };
  return payload;
}
