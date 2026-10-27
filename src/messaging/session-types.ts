import type { SessionSnapshot } from '@/src/domain/session';

export const GET_SESSION_STATE = 'GET_SESSION_STATE';
export const START_SESSION = 'START_SESSION';
export const PAUSE_SESSION = 'PAUSE_SESSION';
export const RESUME_SESSION = 'RESUME_SESSION';
export const STOP_SESSION = 'STOP_SESSION';
export const START_NEW_CAPTURE = 'START_NEW_CAPTURE';
export const DELETE_SESSION = 'DELETE_SESSION';
export const SESSION_STATE_UPDATED = 'SESSION_STATE_UPDATED';

export type SessionRequestType =
  | typeof GET_SESSION_STATE
  | typeof START_SESSION
  | typeof PAUSE_SESSION
  | typeof RESUME_SESSION
  | typeof STOP_SESSION
  | typeof START_NEW_CAPTURE
  | typeof DELETE_SESSION;

export type SessionRequestMessage = {
  type: SessionRequestType;
  targetTabId?: number;
};

export type SessionStateUpdatedMessage = {
  type: typeof SESSION_STATE_UPDATED;
  state: SessionSnapshot;
  revision: number;
};

export type SessionSuccessResponse = {
  ok: true;
  state: SessionSnapshot;
  revision: number;
};

export type SessionErrorResponse = {
  ok: false;
  error: {
    code:
      | 'INVALID_TRANSITION'
      | 'INVALID_MESSAGE'
      | 'STORAGE_ERROR'
      | 'NO_SUPPORTED_TARGET_TAB'
      | 'CONTENT_BOOTSTRAP_FAILED'
      | 'UNSUPPORTED_TARGET_TAB'
      | 'SESSION_CLEAR_FAILED';
    message: string;
  };
};

export type SessionResponse = SessionSuccessResponse | SessionErrorResponse;
