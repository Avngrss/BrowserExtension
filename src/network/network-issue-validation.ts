import {
  issueDispositionOrUnexpected,
  parseIssueDisposition,
} from '@/src/domain/issue-disposition';
import type {
  NetworkIssue,
  NetworkIssueCategory,
  NetworkIssueSource,
  NetworkIssueSubmissionPayload,
} from '@/src/domain/network-issue';
import {
  MAX_NETWORK_FAILURE_MESSAGE_LENGTH,
  MAX_NETWORK_STATUS_TEXT_LENGTH,
  MAX_NETWORK_URL_LENGTH,
  MAX_STORED_NETWORK_ISSUES,
} from '@/src/network/network-limits';
import { sanitizeUrl } from '@/src/privacy/url-sanitizer';

const NETWORK_SOURCES: readonly NetworkIssueSource[] = ['fetch', 'xhr'];

const NETWORK_CATEGORIES: readonly NetworkIssueCategory[] = [
  'http-error',
  'network-failure',
  'timeout',
  'aborted',
];

const HTTP_METHOD_PATTERN = /^[A-Z][A-Z0-9-]{0,19}$/;

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

function isSource(value: unknown): value is NetworkIssueSource {
  return (
    typeof value === 'string' &&
    NETWORK_SOURCES.some((source) => source === value)
  );
}

function isCategory(value: unknown): value is NetworkIssueCategory {
  return (
    typeof value === 'string' &&
    NETWORK_CATEGORIES.some((category) => category === value)
  );
}

function parseSanitizedUrl(value: unknown): string | null {
  if (!isNonEmptyString(value) || value.length > MAX_NETWORK_URL_LENGTH) {
    return null;
  }
  const sanitized = sanitizeUrl(value);
  if (sanitized === null || sanitized !== value) {
    return null;
  }
  return value;
}

function parseMethod(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  const normalized = value.toUpperCase();
  if (!HTTP_METHOD_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
}

function parseOptionalStatusText(value: unknown): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  if (value.length > MAX_NETWORK_STATUS_TEXT_LENGTH) {
    return null;
  }
  return value;
}

function parseOptionalFailureMessage(
  value: unknown,
): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  if (value.length > MAX_NETWORK_FAILURE_MESSAGE_LENGTH) {
    return null;
  }
  return value;
}

function parseOptionalDuration(value: unknown): number | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

function parseHttpStatus(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null;
  }
  if (value < 400 || value > 599) {
    return null;
  }
  return value;
}

function validateCategoryFields(
  category: NetworkIssueCategory,
  status: unknown,
  statusText: unknown,
  failureMessage: unknown,
): boolean {
  if (category === 'http-error') {
    if (parseHttpStatus(status) === null) {
      return false;
    }
    return failureMessage === undefined;
  }
  if (status !== undefined || statusText !== undefined) {
    return false;
  }
  if (failureMessage === undefined) {
    return false;
  }
  return parseOptionalFailureMessage(failureMessage) !== null;
}

export function parseNetworkIssueSubmissionPayload(
  value: unknown,
): NetworkIssueSubmissionPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !hasOnlyKeys(value, [
      'sessionId',
      'timestamp',
      'source',
      'category',
      'method',
      'url',
      'status',
      'statusText',
      'durationMs',
      'failureMessage',
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
  if (!isSource(value.source)) {
    return null;
  }
  if (!isCategory(value.category)) {
    return null;
  }

  const method = parseMethod(value.method);
  const url = parseSanitizedUrl(value.url);
  if (method === null || url === null) {
    return null;
  }

  if (
    !validateCategoryFields(
      value.category,
      value.status,
      value.statusText,
      value.failureMessage,
    )
  ) {
    return null;
  }

  const statusText = parseOptionalStatusText(value.statusText);
  if (statusText === null) {
    return null;
  }
  const failureMessage = parseOptionalFailureMessage(value.failureMessage);
  if (failureMessage === null) {
    return null;
  }
  const durationMs = parseOptionalDuration(value.durationMs);
  if (durationMs === null) {
    return null;
  }

  if (value.category === 'http-error') {
    const status = parseHttpStatus(value.status);
    if (status === null) {
      return null;
    }
    return {
      sessionId: value.sessionId,
      timestamp: value.timestamp,
      source: value.source,
      category: value.category,
      method,
      url,
      status,
      ...(statusText !== undefined ? { statusText } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
    };
  }

  return {
    sessionId: value.sessionId,
    timestamp: value.timestamp,
    source: value.source,
    category: value.category,
    method,
    url,
    failureMessage: failureMessage!,
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}

function parseNetworkIssueCore(
  value: Record<string, unknown>,
  options: { requireDisposition: boolean },
): NetworkIssue | null {
  if (
    !hasOnlyKeys(value, [
      'id',
      'sessionId',
      'timestamp',
      'lastSeenAt',
      'source',
      'category',
      'method',
      'url',
      'status',
      'statusText',
      'durationMs',
      'failureMessage',
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

  const payload = parseNetworkIssueSubmissionPayload({
    sessionId: value.sessionId,
    timestamp: value.timestamp,
    source: value.source,
    category: value.category,
    method: value.method,
    url: value.url,
    status: value.status,
    statusText: value.statusText,
    durationMs: value.durationMs,
    failureMessage: value.failureMessage,
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

export function parseNetworkIssue(value: unknown): NetworkIssue | null {
  if (!isRecord(value)) {
    return null;
  }

  return parseNetworkIssueCore(value, { requireDisposition: true });
}

export function parseNetworkIssueList(value: unknown): NetworkIssue[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (value.length > MAX_STORED_NETWORK_ISSUES) {
    return null;
  }

  const issues: NetworkIssue[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    const parsed = parseNetworkIssueCore(item, { requireDisposition: false });
    if (parsed === null) {
      return null;
    }
    issues.push(parsed);
  }
  return issues;
}
