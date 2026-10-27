import type { SessionSnapshot, SessionStatus } from '@/src/domain/session';

const SESSION_STATUSES: readonly SessionStatus[] = [
  'idle',
  'recording',
  'paused',
  'stopped',
];

const ACTIVE_SESSION_KEYS = [
  'status',
  'id',
  'startedAt',
  'pausedAt',
  'stoppedAt',
  'targetTabId',
  'targetUrl',
  'pageTitle',
  'pageContextUpdatedAt',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isValidTabId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function parseTargetFields(value: Record<string, unknown>): {
  targetTabId: number;
  targetUrl: string;
  pageTitle?: string;
  pageContextUpdatedAt?: number;
} | null {
  if (!isValidTabId(value.targetTabId) || !isNonEmptyString(value.targetUrl)) {
    return null;
  }

  if (value.pageTitle !== undefined && !isNonEmptyString(value.pageTitle)) {
    return null;
  }

  if (
    value.pageContextUpdatedAt !== undefined &&
    !isValidTimestamp(value.pageContextUpdatedAt)
  ) {
    return null;
  }

  return {
    targetTabId: value.targetTabId,
    targetUrl: value.targetUrl,
    pageTitle: value.pageTitle,
    pageContextUpdatedAt: value.pageContextUpdatedAt,
  };
}

export function parseSessionSnapshot(value: unknown): SessionSnapshot | null {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return null;
  }

  if (!SESSION_STATUSES.some((status) => status === value.status)) {
    return null;
  }

  if (value.status === 'idle') {
    if (!hasOnlyKeys(value, ['status'])) {
      return null;
    }
    return { status: 'idle' };
  }

  if (!hasOnlyKeys(value, ACTIVE_SESSION_KEYS)) {
    return null;
  }

  if (!isNonEmptyString(value.id) || !isValidTimestamp(value.startedAt)) {
    return null;
  }

  const target = parseTargetFields(value);
  if (target === null) {
    return null;
  }

  if (value.status === 'recording') {
    if (value.pausedAt !== null || value.stoppedAt !== null) {
      return null;
    }
    return {
      status: 'recording',
      id: value.id,
      startedAt: value.startedAt,
      pausedAt: null,
      stoppedAt: null,
      ...target,
    };
  }

  if (value.status === 'paused') {
    if (
      !isValidTimestamp(value.pausedAt) ||
      value.stoppedAt !== null ||
      value.pausedAt < value.startedAt
    ) {
      return null;
    }
    return {
      status: 'paused',
      id: value.id,
      startedAt: value.startedAt,
      pausedAt: value.pausedAt,
      stoppedAt: null,
      ...target,
    };
  }

  if (value.status === 'stopped') {
    if (!isValidTimestamp(value.stoppedAt)) {
      return null;
    }

    if (value.stoppedAt < value.startedAt) {
      return null;
    }

    if (value.pausedAt === null) {
      return {
        status: 'stopped',
        id: value.id,
        startedAt: value.startedAt,
        pausedAt: null,
        stoppedAt: value.stoppedAt,
        ...target,
      };
    }

    if (
      !isValidTimestamp(value.pausedAt) ||
      value.pausedAt < value.startedAt ||
      value.pausedAt > value.stoppedAt
    ) {
      return null;
    }

    return {
      status: 'stopped',
      id: value.id,
      startedAt: value.startedAt,
      pausedAt: value.pausedAt,
      stoppedAt: value.stoppedAt,
      ...target,
    };
  }

  return null;
}

export function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  return parseSessionSnapshot(value) !== null;
}
