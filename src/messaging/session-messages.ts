import type { SessionSnapshot } from '@/src/domain/session';
import {
  GET_SESSION_STATE,
  PAUSE_SESSION,
  RESUME_SESSION,
  SESSION_STATE_UPDATED,
  START_SESSION,
  START_NEW_CAPTURE,
  DELETE_SESSION,
  STOP_SESSION,
  type SessionRequestMessage,
  type SessionRequestType,
  type SessionResponse,
  type SessionStateUpdatedMessage,
} from '@/src/messaging/session-types';
import type { SessionCommand } from '@/src/domain/session';
import type { SessionBackend } from '@/src/messaging/session-backend';
import { isSessionSnapshot } from '@/src/sessions/session-snapshot-validation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const SESSION_REQUEST_TYPES: readonly SessionRequestType[] = [
  GET_SESSION_STATE,
  START_SESSION,
  PAUSE_SESSION,
  RESUME_SESSION,
  STOP_SESSION,
  START_NEW_CAPTURE,
  DELETE_SESSION,
];

function isSessionRequestType(value: unknown): value is SessionRequestType {
  return (
    typeof value === 'string' &&
    SESSION_REQUEST_TYPES.some((requestType) => requestType === value)
  );
}

export function isSessionRequestMessage(
  message: unknown,
): message is SessionRequestMessage {
  return isRecord(message) && isSessionRequestType(message.type);
}

export function isSessionStateUpdatedMessage(
  message: unknown,
): message is SessionStateUpdatedMessage {
  return (
    isRecord(message) &&
    message.type === SESSION_STATE_UPDATED &&
    isSessionSnapshot(message.state) &&
    typeof message.revision === 'number' &&
    Number.isFinite(message.revision)
  );
}

export function isSessionResponse(value: unknown): value is SessionResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false;
  }

  if (value.ok) {
    return (
      isSessionSnapshot(value.state) &&
      typeof value.revision === 'number' &&
      Number.isFinite(value.revision)
    );
  }

  if (!isRecord(value.error)) {
    return false;
  }

  return (
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

function mapRequestToCommand(type: SessionRequestType): SessionCommand | null {
  switch (type) {
    case START_SESSION:
      return 'start';
    case PAUSE_SESSION:
      return 'pause';
    case RESUME_SESSION:
      return 'resume';
    case STOP_SESSION:
      return 'stop';
    default:
      return null;
  }
}

export async function handleSessionRequestMessage(
  message: SessionRequestMessage,
  backend: SessionBackend,
): Promise<SessionResponse> {
  if (message.type === GET_SESSION_STATE) {
    return backend.getSessionState();
  }

  if (message.type === START_NEW_CAPTURE) {
    return backend.startNewCapture(message.targetTabId);
  }

  if (message.type === DELETE_SESSION) {
    return backend.deleteSession();
  }

  const command = mapRequestToCommand(message.type);
  if (command === null) {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: 'Unsupported session request.',
      },
    };
  }

  if (command === 'start') {
    return backend.runSessionCommand(command, message.targetTabId);
  }

  return backend.runSessionCommand(command);
}

export function createSessionStateUpdatedMessage(
  state: SessionSnapshot,
  revision: number,
): SessionStateUpdatedMessage {
  return {
    type: SESSION_STATE_UPDATED,
    state,
    revision,
  };
}

export function isSessionMutationRequest(
  message: SessionRequestMessage,
): message is Exclude<
  SessionRequestMessage,
  { type: typeof GET_SESSION_STATE }
> {
  return message.type !== GET_SESSION_STATE;
}
