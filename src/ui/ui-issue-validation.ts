import type { SafeElementDescriptor } from '@/src/domain/action';
import {
  issueDispositionOrUnexpected,
  parseIssueDisposition,
} from '@/src/domain/issue-disposition';
import type { UiIssue, UiIssueSubmissionPayload } from '@/src/domain/ui-issue';
import type { UiIssueRuleSeverity } from '@/src/domain/ui-rule';
import {
  MAX_STORED_UI_ISSUES,
  MAX_UI_VISIBLE_MESSAGE_LENGTH,
} from '@/src/ui/ui-issue-limits';
import { sanitizeUrl } from '@/src/privacy/url-sanitizer';

const SEVERITIES: readonly UiIssueRuleSeverity[] = ['warning', 'error'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isSeverity(value: unknown): value is UiIssueRuleSeverity {
  return (
    typeof value === 'string' &&
    SEVERITIES.some((severity) => severity === value)
  );
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function parseSanitizedUrl(value: unknown): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }
  const sanitized = sanitizeUrl(value);
  if (sanitized === null || sanitized !== value) {
    return null;
  }
  return value;
}

function parseUiElementDescriptor(
  value: unknown,
): SafeElementDescriptor | null {
  if (!isRecord(value) || !isNonEmptyString(value.tagName)) {
    return null;
  }
  if (value.visibleText !== undefined) {
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

export function parseUiIssueSubmissionPayload(
  value: unknown,
): UiIssueSubmissionPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !hasOnlyKeys(value, [
      'sessionId',
      'timestamp',
      'ruleId',
      'ruleName',
      'severity',
      'url',
      'element',
      'visibleMessage',
    ])
  ) {
    return null;
  }

  if (!isNonEmptyString(value.sessionId)) {
    return null;
  }
  if (!isValidTimestamp(value.timestamp)) {
    return null;
  }
  if (!isNonEmptyString(value.ruleId)) {
    return null;
  }
  if (!isNonEmptyString(value.ruleName)) {
    return null;
  }
  if (!isSeverity(value.severity)) {
    return null;
  }

  const url = parseSanitizedUrl(value.url);
  const element = parseUiElementDescriptor(value.element);
  if (url === null || element === null) {
    return null;
  }

  let visibleMessage: string | undefined;
  if (value.visibleMessage !== undefined) {
    if (
      typeof value.visibleMessage !== 'string' ||
      value.visibleMessage.length === 0 ||
      value.visibleMessage.length > MAX_UI_VISIBLE_MESSAGE_LENGTH
    ) {
      return null;
    }
    visibleMessage = value.visibleMessage;
  }

  return {
    sessionId: value.sessionId,
    timestamp: value.timestamp,
    ruleId: value.ruleId,
    ruleName: value.ruleName,
    severity: value.severity,
    url,
    element,
    ...(visibleMessage !== undefined ? { visibleMessage } : {}),
  };
}

function parseUiIssueCore(
  value: Record<string, unknown>,
  options: { requireDisposition: boolean },
): UiIssue | null {
  if (
    !hasOnlyKeys(value, [
      'id',
      'sessionId',
      'timestamp',
      'lastSeenAt',
      'ruleId',
      'ruleName',
      'severity',
      'url',
      'element',
      'visibleMessage',
      'occurrenceCount',
      'disposition',
    ])
  ) {
    return null;
  }

  if (!isNonEmptyString(value.id)) {
    return null;
  }
  if (
    typeof value.occurrenceCount !== 'number' ||
    !Number.isInteger(value.occurrenceCount) ||
    value.occurrenceCount < 1
  ) {
    return null;
  }
  if (!isValidTimestamp(value.lastSeenAt)) {
    return null;
  }

  const payload = parseUiIssueSubmissionPayload({
    sessionId: value.sessionId,
    timestamp: value.timestamp,
    ruleId: value.ruleId,
    ruleName: value.ruleName,
    severity: value.severity,
    url: value.url,
    element: value.element,
    visibleMessage: value.visibleMessage,
  });

  if (payload === null) {
    return null;
  }

  let disposition = issueDispositionOrUnexpected(value.disposition);
  if (options.requireDisposition) {
    if (value.disposition === undefined) {
      return null;
    }
    const parsedDisposition = parseIssueDisposition(value.disposition);
    if (parsedDisposition === null) {
      return null;
    }
    disposition = parsedDisposition;
  } else if (value.disposition !== undefined) {
    const parsedDisposition = parseIssueDisposition(value.disposition);
    if (parsedDisposition === null) {
      return null;
    }
    disposition = parsedDisposition;
  }

  return {
    id: value.id,
    ...payload,
    lastSeenAt: value.lastSeenAt,
    occurrenceCount: value.occurrenceCount,
    disposition,
  };
}

export function parseUiIssue(value: unknown): UiIssue | null {
  if (!isRecord(value)) {
    return null;
  }

  return parseUiIssueCore(value, { requireDisposition: true });
}

export function parseUiIssueList(value: unknown): UiIssue[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (value.length > MAX_STORED_UI_ISSUES) {
    return null;
  }

  const issues: UiIssue[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    const parsed = parseUiIssueCore(item, { requireDisposition: false });
    if (parsed === null) {
      return null;
    }
    issues.push(parsed);
  }
  return issues;
}
