export const CONSOLE_BRIDGE_CHANNEL = 'BUG_CAPTURE_ASSISTANT_CONSOLE';
export const CONSOLE_BRIDGE_SCHEMA_VERSION = 1;

export const CONSOLE_BRIDGE_MESSAGE = {
  READY: 'BUG_CAPTURE_ASSISTANT_CONSOLE_BRIDGE_READY',
  REQUEST_READY: 'BUG_CAPTURE_ASSISTANT_CONSOLE_REQUEST_READY',
  ACTIVATE: 'BUG_CAPTURE_ASSISTANT_CONSOLE_ACTIVATE',
  DEACTIVATE: 'BUG_CAPTURE_ASSISTANT_CONSOLE_DEACTIVATE',
  ISSUE: 'BUG_CAPTURE_ASSISTANT_CONSOLE_ISSUE',
  NETWORK_ISSUE: 'BUG_CAPTURE_ASSISTANT_NETWORK_ISSUE',
} as const;

export type ConsoleBridgeMessageType =
  (typeof CONSOLE_BRIDGE_MESSAGE)[keyof typeof CONSOLE_BRIDGE_MESSAGE];

export type ConsoleBridgeEventCategory =
  'console-error' | 'uncaught-error' | 'unhandled-rejection';

export type ConsoleBridgeIssuePayload = {
  type: typeof CONSOLE_BRIDGE_MESSAGE.ISSUE;
  channel: typeof CONSOLE_BRIDGE_CHANNEL;
  schemaVersion: typeof CONSOLE_BRIDGE_SCHEMA_VERSION;
  category: ConsoleBridgeEventCategory;
  parts: string[];
  message?: string;
  stack?: string;
};

export type ConsoleBridgeReadyPayload = {
  type: typeof CONSOLE_BRIDGE_MESSAGE.READY;
  channel: typeof CONSOLE_BRIDGE_CHANNEL;
  schemaVersion: typeof CONSOLE_BRIDGE_SCHEMA_VERSION;
};

export type ConsoleBridgeControlPayload = {
  type:
    | typeof CONSOLE_BRIDGE_MESSAGE.ACTIVATE
    | typeof CONSOLE_BRIDGE_MESSAGE.DEACTIVATE;
  channel: typeof CONSOLE_BRIDGE_CHANNEL;
  schemaVersion: typeof CONSOLE_BRIDGE_SCHEMA_VERSION;
};

export type NetworkBridgeIssueSource = 'fetch' | 'xhr';

export type NetworkBridgeIssueCategory =
  'http-error' | 'network-failure' | 'timeout' | 'aborted';

export type NetworkBridgeIssuePayload = {
  type: typeof CONSOLE_BRIDGE_MESSAGE.NETWORK_ISSUE;
  channel: typeof CONSOLE_BRIDGE_CHANNEL;
  schemaVersion: typeof CONSOLE_BRIDGE_SCHEMA_VERSION;
  source: NetworkBridgeIssueSource;
  category: NetworkBridgeIssueCategory;
  method: string;
  requestUrl: string;
  status?: number;
  statusText?: string;
  durationMs?: number;
  failureMessage?: string;
};
