import type {
  ConsoleIssue,
  ConsoleIssueCategory,
  ConsoleIssueSubmissionPayload,
} from '@/src/domain/console-issue';
import {
  issueDispositionOrUnexpected,
  parseIssueDisposition,
} from '@/src/domain/issue-disposition';
import {
  MAX_CONSOLE_MESSAGE_LENGTH,
  MAX_CONSOLE_STACK_LENGTH,
} from '@/src/console/normalize-console-args';
import { sanitizeUrl } from '@/src/privacy/url-sanitizer';

const CONSOLE_ISSUE_CATEGORIES: readonly ConsoleIssueCategory[] = [
  'console-error',
  'uncaught-error',
  'unhandled-rejection',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isCategory(value: unknown): value is ConsoleIssueCategory {
  return (
    typeof value === 'string' &&
    CONSOLE_ISSUE_CATEGORIES.some((category) => category === value)
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

function parseBoundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  if (value.length > maxLength) {
    return null;
  }
  return value;
}

export function parseConsoleIssueSubmissionPayload(
  value: unknown,
): ConsoleIssueSubmissionPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !hasOnlyKeys(value, [
      'sessionId',
      'timestamp',
      'category',
      'message',
      'url',
      'stack',
    ])
  ) {
    return null;
  }

  if (
    !isNonEmptyString(value.sessionId) ||
    !isValidTimestamp(value.timestamp) ||
    !isCategory(value.category)
  ) {
    return null;
  }

  const message = parseBoundedString(value.message, MAX_CONSOLE_MESSAGE_LENGTH);
  const url = parseSanitizedUrl(value.url);
  if (message === null || url === null) {
    return null;
  }

  let stack: string | undefined;
  if (value.stack !== undefined) {
    const parsedStack = parseBoundedString(
      value.stack,
      MAX_CONSOLE_STACK_LENGTH,
    );
    if (parsedStack === null) {
      return null;
    }
    stack = parsedStack;
  }

  return {
    sessionId: value.sessionId,
    timestamp: value.timestamp,
    category: value.category,
    message,
    url,
    stack,
  };
}

function parseConsoleIssueCore(
  value: Record<string, unknown>,
  options: { requireDisposition: boolean },
): ConsoleIssue | null {
  const allowedKeys = [
    'id',
    'sessionId',
    'timestamp',
    'lastSeenAt',
    'category',
    'message',
    'url',
    'stack',
    'occurrenceCount',
    'disposition',
  ];
  if (!hasOnlyKeys(value, allowedKeys)) {
    return null;
  }

  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.sessionId) ||
    !isValidTimestamp(value.timestamp) ||
    !isValidTimestamp(value.lastSeenAt) ||
    !isCategory(value.category) ||
    typeof value.occurrenceCount !== 'number' ||
    !Number.isInteger(value.occurrenceCount) ||
    value.occurrenceCount < 1
  ) {
    return null;
  }

  const message = parseBoundedString(value.message, MAX_CONSOLE_MESSAGE_LENGTH);
  const url = parseSanitizedUrl(value.url);
  if (message === null || url === null) {
    return null;
  }

  let stack: string | undefined;
  if (value.stack !== undefined) {
    const parsedStack = parseBoundedString(
      value.stack,
      MAX_CONSOLE_STACK_LENGTH,
    );
    if (parsedStack === null) {
      return null;
    }
    stack = parsedStack;
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
    sessionId: value.sessionId,
    timestamp: value.timestamp,
    lastSeenAt: value.lastSeenAt,
    category: value.category,
    message,
    url,
    stack,
    occurrenceCount: value.occurrenceCount,
    disposition,
  };
}

export function parseConsoleIssue(value: unknown): ConsoleIssue | null {
  if (!isRecord(value)) {
    return null;
  }

  return parseConsoleIssueCore(value, { requireDisposition: true });
}

export function parseConsoleIssueList(value: unknown): ConsoleIssue[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed: ConsoleIssue[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    const issue = parseConsoleIssueCore(item, { requireDisposition: false });
    if (issue === null) {
      return null;
    }
    parsed.push(issue);
  }

  return parsed;
}
