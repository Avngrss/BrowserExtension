import type {
  ActionSubmissionPayload,
  ActionType,
  CapturedAction,
  SafeElementDescriptor,
} from '@/src/domain/action';
import { getSemanticElementType } from '@/src/capture/element-semantic';
import { sanitizeUrl } from '@/src/privacy/url-sanitizer';

const ACTION_TYPES: readonly ActionType[] = [
  'click',
  'submit',
  'navigation',
  'input',
  'change',
];

const FORBIDDEN_PAYLOAD_KEYS = new Set(['value']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function parseElementDescriptor(value: unknown): SafeElementDescriptor | null {
  if (!isRecord(value) || !isNonEmptyString(value.tagName)) {
    return null;
  }

  const descriptor: SafeElementDescriptor = {
    tagName: value.tagName.toLowerCase(),
  };

  if (value.role !== undefined) {
    if (!isNonEmptyString(value.role)) {
      return null;
    }
    descriptor.role = value.role;
  }
  if (value.accessibleName !== undefined) {
    if (!isNonEmptyString(value.accessibleName)) {
      return null;
    }
    descriptor.accessibleName = value.accessibleName;
  }
  if (value.visibleText !== undefined) {
    if (!isNonEmptyString(value.visibleText)) {
      return null;
    }
    descriptor.visibleText = value.visibleText;
  }
  if (value.testId !== undefined) {
    if (!isNonEmptyString(value.testId)) {
      return null;
    }
    descriptor.testId = value.testId;
  }
  if (value.inputType !== undefined) {
    if (!isNonEmptyString(value.inputType)) {
      return null;
    }
    descriptor.inputType = value.inputType;
  }
  if (value.semanticType !== undefined) {
    if (!isNonEmptyString(value.semanticType)) {
      return null;
    }
    descriptor.semanticType = value.semanticType;
  }

  return descriptor;
}

function parseBaseFields(value: Record<string, unknown>): {
  sessionId: string;
  timestamp: number;
  url: string;
  pageTitle?: string;
} | null {
  if (
    !isNonEmptyString(value.sessionId) ||
    !isValidTimestamp(value.timestamp)
  ) {
    return null;
  }

  if (!isNonEmptyString(value.url)) {
    return null;
  }

  const sanitizedUrl = sanitizeUrl(value.url);
  if (sanitizedUrl === null || sanitizedUrl !== value.url) {
    return null;
  }

  if (value.pageTitle !== undefined && !isNonEmptyString(value.pageTitle)) {
    return null;
  }

  return {
    sessionId: value.sessionId,
    timestamp: value.timestamp,
    url: value.url,
    pageTitle: value.pageTitle,
  };
}

function hasForbiddenKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => FORBIDDEN_PAYLOAD_KEYS.has(key));
}

function parseInputAction(
  value: Record<string, unknown>,
  base: ReturnType<typeof parseBaseFields>,
): ActionSubmissionPayload | null {
  if (base === null) {
    return null;
  }

  if (
    !hasOnlyKeys(value, [
      'type',
      'sessionId',
      'timestamp',
      'url',
      'pageTitle',
      'element',
      'redacted',
    ])
  ) {
    return null;
  }

  if (value.redacted !== undefined && value.redacted !== true) {
    return null;
  }

  const element = parseElementDescriptor(value.element);
  if (element === null) {
    return null;
  }

  return {
    type: 'input',
    element,
    ...base,
    ...(value.redacted === true ? { redacted: true as const } : {}),
  } as ActionSubmissionPayload;
}

function parseChangeAction(
  value: Record<string, unknown>,
  base: ReturnType<typeof parseBaseFields>,
): ActionSubmissionPayload | null {
  if (base === null) {
    return null;
  }

  if (
    !hasOnlyKeys(value, [
      'type',
      'sessionId',
      'timestamp',
      'url',
      'pageTitle',
      'element',
      'redacted',
      'checked',
    ])
  ) {
    return null;
  }

  if (value.redacted !== undefined && value.redacted !== true) {
    return null;
  }

  if (value.checked !== undefined && typeof value.checked !== 'boolean') {
    return null;
  }

  const element = parseElementDescriptor(value.element);
  if (element === null) {
    return null;
  }

  const semanticType = getSemanticElementType(element);
  if (value.checked !== undefined) {
    if (semanticType !== 'checkbox' && semanticType !== 'radio') {
      return null;
    }
  }

  return {
    type: 'change',
    element,
    ...base,
    ...(value.redacted === true ? { redacted: true as const } : {}),
    ...(value.checked !== undefined ? { checked: value.checked } : {}),
  } as ActionSubmissionPayload;
}

export function parseActionSubmissionPayload(
  value: unknown,
): ActionSubmissionPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  if (hasForbiddenKeys(value)) {
    return null;
  }

  if (
    typeof value.type !== 'string' ||
    !ACTION_TYPES.some((type) => type === value.type)
  ) {
    return null;
  }

  const base = parseBaseFields(value);
  if (base === null) {
    return null;
  }

  if (value.type === 'navigation') {
    if (
      !hasOnlyKeys(value, [
        'type',
        'sessionId',
        'timestamp',
        'url',
        'pageTitle',
      ])
    ) {
      return null;
    }
    return { type: 'navigation', ...base };
  }

  if (value.type === 'input') {
    return parseInputAction(value, base);
  }

  if (value.type === 'change') {
    return parseChangeAction(value, base);
  }

  const element = parseElementDescriptor(value.element);
  if (element === null) {
    return null;
  }

  if (
    !hasOnlyKeys(value, [
      'type',
      'sessionId',
      'timestamp',
      'url',
      'pageTitle',
      'element',
    ])
  ) {
    return null;
  }

  if (value.type === 'click') {
    return { type: 'click', element, ...base } as ActionSubmissionPayload;
  }

  return { type: 'submit', element, ...base } as ActionSubmissionPayload;
}

export function parseCapturedAction(value: unknown): CapturedAction | null {
  if (!isRecord(value) || !isNonEmptyString(value.id)) {
    return null;
  }

  const withoutId = { ...value };
  delete withoutId.id;
  const payload = parseActionSubmissionPayload(withoutId);
  if (payload === null) {
    return null;
  }

  return { id: value.id, ...payload } as CapturedAction;
}

export function parseCapturedActionList(
  value: unknown,
): CapturedAction[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const actions: CapturedAction[] = [];
  for (const item of value) {
    const parsed = parseCapturedAction(item);
    if (parsed === null) {
      return null;
    }
    actions.push(parsed);
  }

  return actions;
}
