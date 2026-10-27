export const MAX_CONSOLE_ARGUMENTS = 10;
export const MAX_CONSOLE_NESTING_DEPTH = 2;
export const MAX_CONSOLE_MESSAGE_LENGTH = 2_000;
export const MAX_CONSOLE_STACK_LENGTH = 8_000;

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

function serializePrimitive(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }
  return '[Unknown]';
}

function isDomNode(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'nodeType' in value && typeof value.nodeType === 'number';
}

function serializeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): string {
  if (value instanceof Error) {
    const parts = [value.name, value.message].filter(Boolean).join(': ');
    return parts.length > 0 ? parts : 'Error';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    value === null ||
    value === undefined
  ) {
    return serializePrimitive(value);
  }

  if (typeof value === 'symbol') {
    return '[Symbol]';
  }

  if (typeof value === 'function') {
    return '[Function]';
  }

  if (isDomNode(value)) {
    return '[DOM Node]';
  }

  if (typeof value !== 'object') {
    return serializePrimitive(value);
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (depth >= MAX_CONSOLE_NESTING_DEPTH) {
    return '[Object]';
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_CONSOLE_ARGUMENTS)
      .map((item) => serializeValue(item, depth + 1, seen));
    return `[${items.join(', ')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).slice(
    0,
    MAX_CONSOLE_ARGUMENTS,
  );
  if (entries.length === 0) {
    return '[Object]';
  }

  const serializedEntries = entries.map(
    ([key, entryValue]) =>
      `${key}: ${serializeValue(entryValue, depth + 1, seen)}`,
  );
  return `{${serializedEntries.join(', ')}}`;
}

export function normalizeConsoleArguments(args: readonly unknown[]): string {
  const limited = args.slice(0, MAX_CONSOLE_ARGUMENTS);
  const seen = new WeakSet<object>();
  const parts = limited.map((arg) => serializeValue(arg, 0, seen));
  return truncate(parts.join(' '), MAX_CONSOLE_MESSAGE_LENGTH);
}

export function extractErrorStack(error: unknown): string | undefined {
  if (!(error instanceof Error) || error.stack === undefined) {
    return undefined;
  }
  return truncate(error.stack, MAX_CONSOLE_STACK_LENGTH);
}

export function normalizeRejectionReason(reason: unknown): {
  message: string;
  stack?: string;
} {
  if (reason instanceof Error) {
    return {
      message: truncate(
        reason.message.length > 0 ? reason.message : reason.name,
        MAX_CONSOLE_MESSAGE_LENGTH,
      ),
      stack: extractErrorStack(reason),
    };
  }

  return {
    message: truncate(
      normalizeConsoleArguments([reason]),
      MAX_CONSOLE_MESSAGE_LENGTH,
    ),
  };
}
