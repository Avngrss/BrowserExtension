import {
  CONSOLE_BRIDGE_CHANNEL,
  CONSOLE_BRIDGE_MESSAGE,
  CONSOLE_BRIDGE_SCHEMA_VERSION,
  type ConsoleBridgeEventCategory,
} from '@/src/capture/console-bridge-constants';
import {
  MAX_BRIDGE_STACK_LENGTH,
  serializeBridgeArgument,
  serializeBridgeArguments,
  truncateBridgeText,
} from '@/src/capture/console-bridge-serialize';
import {
  installMainWorldNetworkMonitoring,
  teardownMainWorldNetworkMonitoringForTests,
} from '@/src/capture/console-main-world-network';
function logBridgeDev(_message: string): void {
  if (import.meta.env.DEV) {
    console.info(_message);
  }
}

let bridgeInstalled = false;
let originalConsoleError: typeof console.error | undefined;
let bridgeActive = false;
let capturingConsoleError = false;

const recentIssueKeys = new Map<string, number>();
const DEDUPE_WINDOW_MS = 100;

function postBridgeReady(): void {
  window.postMessage(
    {
      type: CONSOLE_BRIDGE_MESSAGE.READY,
      channel: CONSOLE_BRIDGE_CHANNEL,
      schemaVersion: CONSOLE_BRIDGE_SCHEMA_VERSION,
    },
    '*',
  );
}

function shouldEmitIssue(
  category: ConsoleBridgeEventCategory,
  key: string,
): boolean {
  const now = Date.now();
  const composite = `${category}\u0000${key}`;
  const previous = recentIssueKeys.get(composite);
  if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) {
    return false;
  }
  recentIssueKeys.set(composite, now);
  return true;
}

function emitIssue(payload: {
  category: ConsoleBridgeEventCategory;
  parts?: string[];
  message?: string;
  stack?: string;
}): void {
  if (!bridgeActive) {
    return;
  }

  const dedupeKey =
    payload.category === 'console-error'
      ? (payload.parts ?? []).join(' ')
      : (payload.message ?? '');

  if (!shouldEmitIssue(payload.category, dedupeKey)) {
    return;
  }

  window.postMessage(
    {
      type: CONSOLE_BRIDGE_MESSAGE.ISSUE,
      channel: CONSOLE_BRIDGE_CHANNEL,
      schemaVersion: CONSOLE_BRIDGE_SCHEMA_VERSION,
      category: payload.category,
      parts: payload.parts ?? [],
      ...(payload.message !== undefined ? { message: payload.message } : {}),
      ...(payload.stack !== undefined ? { stack: payload.stack } : {}),
    },
    '*',
  );
}

function isResourceLoadingError(event: ErrorEvent): boolean {
  const target = event.target;
  return target !== null && target !== window && typeof target === 'object';
}

function handleControlMessage(data: unknown): void {
  if (typeof data !== 'object' || data === null) {
    return;
  }
  const message = data as Record<string, unknown>;
  if (
    message.channel !== CONSOLE_BRIDGE_CHANNEL ||
    message.schemaVersion !== CONSOLE_BRIDGE_SCHEMA_VERSION
  ) {
    return;
  }
  if (message.type === CONSOLE_BRIDGE_MESSAGE.REQUEST_READY) {
    postBridgeReady();
    return;
  }
  if (message.type === CONSOLE_BRIDGE_MESSAGE.ACTIVATE) {
    bridgeActive = true;
    logBridgeDev('Bug Capture Assistant console bridge activated.');
    return;
  }
  if (message.type === CONSOLE_BRIDGE_MESSAGE.DEACTIVATE) {
    bridgeActive = false;
    logBridgeDev('Bug Capture Assistant console bridge deactivated.');
  }
}

function handleUncaughtRuntimeError(event: ErrorEvent): void {
  if (!bridgeActive || isResourceLoadingError(event)) {
    return;
  }

  const stack =
    event.error instanceof Error && typeof event.error.stack === 'string'
      ? event.error.stack.slice(0, MAX_BRIDGE_STACK_LENGTH)
      : undefined;
  const message = truncateBridgeText(
    String(event.message ?? 'Uncaught error'),
    500,
  );

  emitIssue({
    category: 'uncaught-error',
    message,
    stack,
  });
}

export function handleUncaughtRuntimeErrorForTests(event: ErrorEvent): void {
  handleUncaughtRuntimeError(event);
}

export function installMainWorldConsoleBridge(): void {
  if (bridgeInstalled) {
    postBridgeReady();
    return;
  }

  bridgeInstalled = true;
  originalConsoleError = console.error.bind(console);

  console.error = function (...args: unknown[]): void {
    originalConsoleError?.apply(console, args);
    if (!bridgeActive || capturingConsoleError) {
      return;
    }

    capturingConsoleError = true;
    try {
      emitIssue({
        category: 'console-error',
        parts: serializeBridgeArguments(args),
      });
    } finally {
      capturingConsoleError = false;
    }
  };

  window.addEventListener('error', handleUncaughtRuntimeError);

  window.addEventListener('unhandledrejection', (event) => {
    if (!bridgeActive) {
      return;
    }

    const reason: unknown = event.reason;
    let message = 'Unhandled rejection';
    let stack: string | undefined;

    if (reason instanceof Error) {
      message = truncateBridgeText(
        reason.message.length > 0 ? reason.message : reason.name,
        500,
      );
      if (typeof reason.stack === 'string') {
        stack = reason.stack.slice(0, MAX_BRIDGE_STACK_LENGTH);
      }
    } else {
      const seen = new WeakSet<object>();
      message = truncateBridgeText(
        serializeBridgeArgument(reason, 0, seen),
        500,
      );
    }

    emitIssue({
      category: 'unhandled-rejection',
      message,
      stack,
    });
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }
    handleControlMessage(event.data);
  });

  installMainWorldNetworkMonitoring({
    isActive: () => bridgeActive,
    emit: (payload) => {
      window.postMessage(
        {
          type: CONSOLE_BRIDGE_MESSAGE.NETWORK_ISSUE,
          channel: CONSOLE_BRIDGE_CHANNEL,
          schemaVersion: CONSOLE_BRIDGE_SCHEMA_VERSION,
          ...payload,
        },
        '*',
      );
    },
  });

  logBridgeDev('Bug Capture Assistant MAIN-world console bridge initialized.');
  postBridgeReady();
}

export function isMainWorldConsoleBridgeInstalledForTests(): boolean {
  return bridgeInstalled;
}

export function setMainWorldBridgeActiveForTests(active: boolean): void {
  bridgeActive = active;
}

export function teardownMainWorldConsoleBridgeForTests(): void {
  if (!bridgeInstalled || originalConsoleError === undefined) {
    bridgeInstalled = false;
    bridgeActive = false;
    return;
  }
  console.error = originalConsoleError;
  bridgeInstalled = false;
  bridgeActive = false;
  originalConsoleError = undefined;
  recentIssueKeys.clear();
  teardownMainWorldNetworkMonitoringForTests();
}
