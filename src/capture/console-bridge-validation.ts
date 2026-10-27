import {
  CONSOLE_BRIDGE_CHANNEL,
  CONSOLE_BRIDGE_MESSAGE,
  CONSOLE_BRIDGE_SCHEMA_VERSION,
  type ConsoleBridgeEventCategory,
  type ConsoleBridgeIssuePayload,
  type ConsoleBridgeReadyPayload,
} from '@/src/capture/console-bridge-constants';

const BRIDGE_CATEGORIES: readonly ConsoleBridgeEventCategory[] = [
  'console-error',
  'uncaught-error',
  'unhandled-rejection',
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

function isCategory(value: unknown): value is ConsoleBridgeEventCategory {
  return (
    typeof value === 'string' &&
    BRIDGE_CATEGORIES.some((category) => category === value)
  );
}

function parseParts(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (value.length === 0 || value.length > 10) {
    return null;
  }
  const parts: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || item.length > 500) {
      return null;
    }
    parts.push(item);
  }
  return parts;
}

export function parseConsoleBridgeReadyMessage(
  data: unknown,
): ConsoleBridgeReadyPayload | null {
  if (!isRecord(data) || !hasValidEnvelope(data)) {
    return null;
  }
  if (data.type !== CONSOLE_BRIDGE_MESSAGE.READY) {
    return null;
  }
  return {
    type: CONSOLE_BRIDGE_MESSAGE.READY,
    channel: CONSOLE_BRIDGE_CHANNEL,
    schemaVersion: CONSOLE_BRIDGE_SCHEMA_VERSION,
  };
}

export function parseConsoleBridgeIssueMessage(
  data: unknown,
): ConsoleBridgeIssuePayload | null {
  if (!isRecord(data) || !hasValidEnvelope(data)) {
    return null;
  }
  if (data.type !== CONSOLE_BRIDGE_MESSAGE.ISSUE) {
    return null;
  }
  if (!isCategory(data.category)) {
    return null;
  }

  if (data.category === 'console-error') {
    const parts = parseParts(data.parts);
    if (parts === null) {
      return null;
    }
    return {
      type: CONSOLE_BRIDGE_MESSAGE.ISSUE,
      channel: CONSOLE_BRIDGE_CHANNEL,
      schemaVersion: CONSOLE_BRIDGE_SCHEMA_VERSION,
      category: data.category,
      parts,
    };
  }

  if (typeof data.message !== 'string' || data.message.length === 0) {
    return null;
  }
  if (data.message.length > 500) {
    return null;
  }

  let stack: string | undefined;
  if (data.stack !== undefined) {
    if (typeof data.stack !== 'string' || data.stack.length > 8_000) {
      return null;
    }
    stack = data.stack;
  }

  return {
    type: CONSOLE_BRIDGE_MESSAGE.ISSUE,
    channel: CONSOLE_BRIDGE_CHANNEL,
    schemaVersion: CONSOLE_BRIDGE_SCHEMA_VERSION,
    category: data.category,
    parts: [],
    message: data.message,
    stack,
  };
}

/** @deprecated Use parseConsoleBridgeIssueMessage */
export function parseConsoleBridgeEvent(
  data: unknown,
): ConsoleBridgeIssuePayload | null {
  return parseConsoleBridgeIssueMessage(data);
}
