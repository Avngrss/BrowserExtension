import type { SafeElementDescriptor } from '@/src/domain/action';

const VALID_EXPLICIT_ROLES = new Set([
  'button',
  'checkbox',
  'combobox',
  'form',
  'link',
  'radio',
  'textbox',
]);

const USER_FACING_ELEMENT_KINDS = new Set([
  'button',
  'checkbox',
  'combobox',
  'form',
  'link',
  'radio',
  'textbox',
  'control',
]);

function normalizeRole(role: string): string | undefined {
  const normalized = role.trim().toLowerCase();
  if (normalized.length === 0 || !VALID_EXPLICIT_ROLES.has(normalized)) {
    return undefined;
  }
  return normalized;
}

export function inferSemanticElementType(
  tagName: string,
  options: {
    role?: string;
    inputType?: string;
    hasHref?: boolean;
  } = {},
): string {
  const explicitRole = options.role ? normalizeRole(options.role) : undefined;
  if (explicitRole !== undefined) {
    return explicitRole;
  }

  const tag = tagName.toLowerCase();

  if (tag === 'a' && options.hasHref !== false) {
    return 'link';
  }
  if (tag === 'button') {
    return 'button';
  }
  if (tag === 'form') {
    return 'form';
  }
  if (tag === 'select') {
    return 'combobox';
  }
  if (tag === 'textarea') {
    return 'textbox';
  }
  if (tag === 'input') {
    const inputType = (options.inputType ?? 'text').toLowerCase();
    if (inputType === 'button' || inputType === 'submit') {
      return 'button';
    }
    if (inputType === 'checkbox') {
      return 'checkbox';
    }
    if (inputType === 'radio') {
      return 'radio';
    }
    if (
      inputType === 'text' ||
      inputType === 'search' ||
      inputType === 'email' ||
      inputType === 'tel' ||
      inputType === 'url' ||
      inputType === 'number' ||
      inputType === 'password'
    ) {
      return 'textbox';
    }

    return 'textbox';
  }

  return 'control';
}

function storedSemanticTypeLooksLikeHtmlTag(
  semanticType: string,
  tagName: string,
): boolean {
  const normalized = semanticType.trim().toLowerCase();
  const tag = tagName.trim().toLowerCase();
  return normalized === tag || !USER_FACING_ELEMENT_KINDS.has(normalized);
}

export function getSemanticElementType(
  descriptor: SafeElementDescriptor,
): string {
  if (
    descriptor.semanticType !== undefined &&
    !storedSemanticTypeLooksLikeHtmlTag(
      descriptor.semanticType,
      descriptor.tagName,
    )
  ) {
    return descriptor.semanticType;
  }

  return inferSemanticElementType(descriptor.tagName, {
    role: descriptor.role,
    inputType: descriptor.inputType,
    hasHref: descriptor.tagName === 'a',
  });
}

export function getUserFacingElementKind(
  descriptor: SafeElementDescriptor,
): string {
  const semantic = getSemanticElementType(descriptor);
  if (USER_FACING_ELEMENT_KINDS.has(semantic)) {
    return semantic;
  }
  return 'control';
}
