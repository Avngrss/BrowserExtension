export const MAX_BRIDGE_PARTS = 10;
export const MAX_BRIDGE_PART_LENGTH = 500;
export const MAX_BRIDGE_STACK_LENGTH = 8_000;

export function truncateBridgeText(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1)}…`;
}

export function serializeBridgeArgument(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): string {
  if (value instanceof Error) {
    return truncateBridgeText(
      value.name + (value.message ? `: ${value.message}` : ''),
      MAX_BRIDGE_PART_LENGTH,
    );
  }
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return truncateBridgeText(value, MAX_BRIDGE_PART_LENGTH);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }
  if (typeof value === 'symbol') {
    return '[Symbol]';
  }
  if (typeof value === 'function') {
    return '[Function]';
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'nodeType' in value &&
    typeof value.nodeType === 'number'
  ) {
    return '[DOM Node]';
  }
  if (typeof value !== 'object' || value === null) {
    return '[Unknown]';
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  if (depth >= 2) {
    return '[Object]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return `[${value
      .slice(0, MAX_BRIDGE_PARTS)
      .map((item) => serializeBridgeArgument(item, depth + 1, seen))
      .join(', ')}]`;
  }

  const entries = Object.entries(value).slice(0, MAX_BRIDGE_PARTS);
  if (entries.length === 0) {
    return '[Object]';
  }

  return `{${entries
    .map(
      ([key, entryValue]) =>
        `${key}: ${serializeBridgeArgument(entryValue, depth + 1, seen)}`,
    )
    .join(', ')}}`;
}

export function serializeBridgeArguments(args: readonly unknown[]): string[] {
  const seen = new WeakSet<object>();
  return args
    .slice(0, MAX_BRIDGE_PARTS)
    .map((arg) => serializeBridgeArgument(arg, 0, seen));
}
