import type { SessionSnapshot } from '@/src/domain/session';
import {
  GET_SESSION_STATE,
  PAUSE_SESSION,
  RESUME_SESSION,
  START_SESSION,
  START_NEW_CAPTURE,
  DELETE_SESSION,
  STOP_SESSION,
  type SessionRequestType,
  type SessionResponse,
} from '@/src/messaging/session-types';
import {
  createSessionStateUpdatedMessage,
  isSessionResponse,
  isSessionStateUpdatedMessage,
} from '@/src/messaging/session-messages';
import { SESSION_COMMAND_FAILED_MESSAGE } from '@/src/messaging/session-feedback';
import { browser } from 'wxt/browser';

export {
  SESSION_COMMAND_FAILED_MESSAGE,
  SESSION_SYNC_FAILED_MESSAGE,
} from '@/src/messaging/session-feedback';

function getRuntime() {
  if (typeof browser === 'undefined') {
    return undefined;
  }

  return browser.runtime;
}

async function readActiveTargetTabId(): Promise<number | undefined> {
  const runtime = getRuntime();
  if (runtime === undefined) {
    return undefined;
  }
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tabs[0]?.id;
  } catch {
    return undefined;
  }
}

async function sendSessionRequest(
  type: SessionRequestType,
  targetTabId?: number,
): Promise<SessionResponse> {
  const runtime = getRuntime();
  if (runtime === undefined) {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: SESSION_COMMAND_FAILED_MESSAGE,
      },
    };
  }

  try {
    const response: unknown = await runtime.sendMessage({
      type,
      ...(targetTabId !== undefined ? { targetTabId } : {}),
    });
    if (!isSessionResponse(response)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: SESSION_COMMAND_FAILED_MESSAGE,
        },
      };
    }

    return response;
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: SESSION_COMMAND_FAILED_MESSAGE,
      },
    };
  }
}

export const sessionClient = {
  getState(): Promise<SessionResponse> {
    return sendSessionRequest(GET_SESSION_STATE);
  },
  async start(): Promise<SessionResponse> {
    const targetTabId = await readActiveTargetTabId();
    return sendSessionRequest(START_SESSION, targetTabId);
  },
  pause(): Promise<SessionResponse> {
    return sendSessionRequest(PAUSE_SESSION);
  },
  resume(): Promise<SessionResponse> {
    return sendSessionRequest(RESUME_SESSION);
  },
  stop(): Promise<SessionResponse> {
    return sendSessionRequest(STOP_SESSION);
  },
  async startNewCapture(): Promise<SessionResponse> {
    const targetTabId = await readActiveTargetTabId();
    return sendSessionRequest(START_NEW_CAPTURE, targetTabId);
  },
  deleteSession(): Promise<SessionResponse> {
    return sendSessionRequest(DELETE_SESSION);
  },
  subscribe(onState: (state: SessionSnapshot) => void): () => void {
    const runtime = getRuntime();
    if (runtime === undefined) {
      return () => undefined;
    }

    const listener = (message: unknown): void => {
      if (isSessionStateUpdatedMessage(message)) {
        onState(message.state);
      }
    };

    runtime.onMessage.addListener(listener);
    return () => {
      runtime.onMessage.removeListener(listener);
    };
  },
  createStateUpdatedMessage(state: SessionSnapshot, revision: number) {
    return createSessionStateUpdatedMessage(state, revision);
  },
};
