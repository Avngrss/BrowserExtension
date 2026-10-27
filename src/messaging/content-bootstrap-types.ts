export const CONTENT_BOOTSTRAP_PROTOCOL_VERSION = 1;

export const CONTENT_BOOTSTRAP_PING = 'CONTENT_BOOTSTRAP_PING' as const;
export const CONTENT_BOOTSTRAP_PONG = 'CONTENT_BOOTSTRAP_PONG' as const;

export type ContentBootstrapPingMessage = {
  type: typeof CONTENT_BOOTSTRAP_PING;
  protocolVersion: typeof CONTENT_BOOTSTRAP_PROTOCOL_VERSION;
  buildVersion: string;
  runtimeId: string;
};

export type ContentBootstrapPongMessage = {
  type: typeof CONTENT_BOOTSTRAP_PONG;
  protocolVersion: typeof CONTENT_BOOTSTRAP_PROTOCOL_VERSION;
  buildVersion: string;
  runtimeId: string;
  contentInstanceId: string;
  documentId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isContentBootstrapPingMessage(
  message: unknown,
): message is ContentBootstrapPingMessage {
  return (
    isRecord(message) &&
    message.type === CONTENT_BOOTSTRAP_PING &&
    message.protocolVersion === CONTENT_BOOTSTRAP_PROTOCOL_VERSION &&
    typeof message.buildVersion === 'string' &&
    typeof message.runtimeId === 'string'
  );
}

export function createContentBootstrapPing(input: {
  buildVersion: string;
  runtimeId: string;
}): ContentBootstrapPingMessage {
  return {
    type: CONTENT_BOOTSTRAP_PING,
    protocolVersion: CONTENT_BOOTSTRAP_PROTOCOL_VERSION,
    buildVersion: input.buildVersion,
    runtimeId: input.runtimeId,
  };
}

export function isCompatibleBootstrapPong(
  pong: ContentBootstrapPongMessage,
  expected: { buildVersion: string; runtimeId: string },
): boolean {
  return (
    pong.protocolVersion === CONTENT_BOOTSTRAP_PROTOCOL_VERSION &&
    pong.buildVersion === expected.buildVersion &&
    pong.runtimeId === expected.runtimeId
  );
}

export function getOrCreateDocumentId(): string {
  const root = document.documentElement;
  const existing = root.dataset.bugCaptureAssistantDocumentId;
  if (existing !== undefined && existing.length > 0) {
    return existing;
  }
  const id = crypto.randomUUID();
  root.dataset.bugCaptureAssistantDocumentId = id;
  return id;
}
