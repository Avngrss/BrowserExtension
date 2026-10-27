import {
  CONSOLE_BRIDGE_CHANNEL,
  CONSOLE_BRIDGE_MESSAGE,
  CONSOLE_BRIDGE_SCHEMA_VERSION,
  type NetworkBridgeIssueCategory,
  type NetworkBridgeIssuePayload,
  type NetworkBridgeIssueSource,
} from '@/src/capture/console-bridge-constants';
import {
  MAX_NETWORK_FAILURE_MESSAGE_LENGTH,
  MAX_NETWORK_STATUS_TEXT_LENGTH,
  MAX_NETWORK_URL_LENGTH,
} from '@/src/network/network-limits';

const NETWORK_SOURCES: readonly NetworkBridgeIssueSource[] = ['fetch', 'xhr'];

const NETWORK_CATEGORIES: readonly NetworkBridgeIssueCategory[] = [
  'http-error',
  'network-failure',
  'timeout',
  'aborted',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasValidEnvelope(value: Record<string, unknown>): boolean {
  return (
    value.channel === CONSOLE_BRIDGE_CHANNEL &&
    value.schemaVersion === CONSOLE_BRIDGE_SCHEMA_VERSION &&
    typeof value.type === 'string'
  );
}

function isSource(value: unknown): value is NetworkBridgeIssueSource {
  return (
    typeof value === 'string' &&
    NETWORK_SOURCES.some((source) => source === value)
  );
}

function isCategory(value: unknown): value is NetworkBridgeIssueCategory {
  return (
    typeof value === 'string' &&
    NETWORK_CATEGORIES.some((category) => category === value)
  );
}

export function parseNetworkBridgeIssueMessage(
  data: unknown,
): NetworkBridgeIssuePayload | null {
  if (!isRecord(data) || !hasValidEnvelope(data)) {
    return null;
  }
  if (data.type !== CONSOLE_BRIDGE_MESSAGE.NETWORK_ISSUE) {
    return null;
  }
  if (!isSource(data.source) || !isCategory(data.category)) {
    return null;
  }
  if (typeof data.method !== 'string' || data.method.length === 0) {
    return null;
  }
  if (data.method.length > 20) {
    return null;
  }
  if (
    typeof data.requestUrl !== 'string' ||
    data.requestUrl.length === 0 ||
    data.requestUrl.length > MAX_NETWORK_URL_LENGTH
  ) {
    return null;
  }

  if (data.category === 'http-error') {
    if (
      typeof data.status !== 'number' ||
      !Number.isInteger(data.status) ||
      data.status < 400 ||
      data.status > 599
    ) {
      return null;
    }
    let statusText: string | undefined;
    if (data.statusText !== undefined) {
      if (
        typeof data.statusText !== 'string' ||
        data.statusText.length === 0 ||
        data.statusText.length > MAX_NETWORK_STATUS_TEXT_LENGTH
      ) {
        return null;
      }
      statusText = data.statusText;
    }
    let durationMs: number | undefined;
    if (data.durationMs !== undefined) {
      if (
        typeof data.durationMs !== 'number' ||
        !Number.isFinite(data.durationMs) ||
        data.durationMs < 0
      ) {
        return null;
      }
      durationMs = data.durationMs;
    }
    return {
      type: CONSOLE_BRIDGE_MESSAGE.NETWORK_ISSUE,
      channel: CONSOLE_BRIDGE_CHANNEL,
      schemaVersion: CONSOLE_BRIDGE_SCHEMA_VERSION,
      source: data.source,
      category: data.category,
      method: data.method,
      requestUrl: data.requestUrl,
      status: data.status,
      ...(statusText !== undefined ? { statusText } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
    };
  }

  if (
    data.status !== undefined ||
    data.statusText !== undefined ||
    data.failureMessage === undefined
  ) {
    return null;
  }
  if (
    typeof data.failureMessage !== 'string' ||
    data.failureMessage.length === 0 ||
    data.failureMessage.length > MAX_NETWORK_FAILURE_MESSAGE_LENGTH
  ) {
    return null;
  }

  let durationMs: number | undefined;
  if (data.durationMs !== undefined) {
    if (
      typeof data.durationMs !== 'number' ||
      !Number.isFinite(data.durationMs) ||
      data.durationMs < 0
    ) {
      return null;
    }
    durationMs = data.durationMs;
  }

  return {
    type: CONSOLE_BRIDGE_MESSAGE.NETWORK_ISSUE,
    channel: CONSOLE_BRIDGE_CHANNEL,
    schemaVersion: CONSOLE_BRIDGE_SCHEMA_VERSION,
    source: data.source,
    category: data.category,
    method: data.method,
    requestUrl: data.requestUrl,
    failureMessage: data.failureMessage,
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}
