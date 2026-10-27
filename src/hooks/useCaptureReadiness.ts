import { useCallback, useEffect, useState } from 'react';
import type { SessionSnapshot, SessionStatus } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';
import {
  buildCaptureStartDiagnostics,
  captureStartFailureMessage,
  logCaptureStartDiagnostics,
} from '@/src/capture/capture-start-diagnostics';
import {
  CAPTURE_READINESS_UPDATED,
  GET_CAPTURE_READINESS,
  REBROADCAST_SESSION_TO_TAB,
  type CaptureReadinessSnapshot,
  type CaptureReadinessUpdatedMessage,
} from '@/src/messaging/capture-readiness-types';
import { browser } from 'wxt/browser';

export const CAPTURE_START_FAILED_MESSAGE =
  'Capture could not start on this page.';

const READINESS_TIMEOUT_MS = 12_000;

export type CapturePhase =
  'idle' | 'starting' | 'capturing' | 'reconnecting' | 'paused' | 'failed';

function isCaptureReadinessUpdatedMessage(
  message: unknown,
): message is CaptureReadinessUpdatedMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === CAPTURE_READINESS_UPDATED
  );
}

function collectorsReady(snapshot: CaptureReadinessSnapshot | null): boolean {
  if (snapshot === null) {
    return false;
  }
  const flags = snapshot.collectors;
  return flags.actions && flags.ui && flags.console && flags.network;
}

function readinessMatchesSession(
  snapshot: CaptureReadinessSnapshot | null,
  sessionId: string | undefined,
): boolean {
  if (snapshot === null || sessionId === undefined) {
    return false;
  }
  return snapshot.sessionId === sessionId;
}

function testModeResult(input: { status: SessionStatus }): {
  phase: CapturePhase;
  readiness: null;
  startFailed: boolean;
  startFailureMessage: string;
  tryAgain: () => void;
} {
  let phase: CapturePhase = 'idle';
  if (input.status === 'paused') {
    phase = 'paused';
  } else if (input.status === 'recording') {
    phase = 'capturing';
  }
  return {
    phase,
    readiness: null,
    startFailed: false,
    startFailureMessage: CAPTURE_START_FAILED_MESSAGE,
    tryAgain: () => undefined,
  };
}

export function useCaptureReadiness(input: {
  snapshot: SessionSnapshot;
  status: SessionStatus;
}): {
  phase: CapturePhase;
  readiness: CaptureReadinessSnapshot | null;
  startFailed: boolean;
  startFailureMessage: string;
  tryAgain: () => void;
} {
  const [readiness, setReadiness] = useState<CaptureReadinessSnapshot | null>(
    null,
  );
  const [startFailed, setStartFailed] = useState(false);
  const [startFailureMessage, setStartFailureMessage] = useState(
    CAPTURE_START_FAILED_MESSAGE,
  );
  const [recordingStartedAt, setRecordingStartedAt] = useState<
    number | undefined
  >(undefined);

  const refresh = useCallback(async () => {
    if (typeof browser === 'undefined') {
      return;
    }
    try {
      const response: unknown = await browser.runtime.sendMessage({
        type: GET_CAPTURE_READINESS,
      });
      if (
        typeof response === 'object' &&
        response !== null &&
        'ok' in response &&
        response.ok === true &&
        'readiness' in response
      ) {
        setReadiness(
          (response as { readiness: CaptureReadinessSnapshot | null })
            .readiness,
        );
      }
    } catch {
      // Ignore transient runtime errors.
    }
  }, []);

  const recordingSessionId =
    isActiveSession(input.snapshot) && input.status === 'recording'
      ? input.snapshot.id
      : undefined;

  useEffect(() => {
    if (typeof browser === 'undefined') {
      return;
    }

    const listener = (message: unknown): void => {
      if (!isCaptureReadinessUpdatedMessage(message)) {
        return;
      }
      setReadiness((current) => {
        const next = message.readiness;
        if (next === null) {
          return null;
        }
        if (
          recordingSessionId === undefined ||
          next.sessionId !== recordingSessionId
        ) {
          if (current?.sessionId === recordingSessionId) {
            return current;
          }
          return null;
        }
        return next;
      });
    };

    browser.runtime.onMessage.addListener(listener);
    void refresh();

    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }, [refresh, recordingSessionId]);

  useEffect(() => {
    if (input.status === 'recording') {
      setRecordingStartedAt((current) => current ?? Date.now());
      setStartFailed(false);
      setStartFailureMessage(CAPTURE_START_FAILED_MESSAGE);
      return;
    }
    setRecordingStartedAt(undefined);
    if (input.status !== 'paused') {
      setReadiness(null);
    }
  }, [input.status]);

  useEffect(() => {
    if (recordingSessionId === undefined) {
      return;
    }
    setReadiness(null);
    setStartFailed(false);
    setStartFailureMessage(CAPTURE_START_FAILED_MESSAGE);
    setRecordingStartedAt(Date.now());
  }, [recordingSessionId]);

  useEffect(() => {
    if (input.status !== 'recording' || recordingStartedAt === undefined) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (
        !readinessMatchesSession(readiness, recordingSessionId) ||
        !collectorsReady(readiness)
      ) {
        const diagnostics = buildCaptureStartDiagnostics({
          readiness,
          expectedSessionId: recordingSessionId,
        });
        logCaptureStartDiagnostics(diagnostics);
        setStartFailureMessage(captureStartFailureMessage(diagnostics));
        setStartFailed(true);
      }
    }, READINESS_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [input.status, recordingStartedAt, readiness, recordingSessionId]);

  useEffect(() => {
    if (
      readinessMatchesSession(readiness, recordingSessionId) &&
      collectorsReady(readiness)
    ) {
      setStartFailed(false);
      setStartFailureMessage(CAPTURE_START_FAILED_MESSAGE);
    }
  }, [readiness, recordingSessionId]);

  const tryAgain = useCallback(() => {
    setStartFailed(false);
    setStartFailureMessage(CAPTURE_START_FAILED_MESSAGE);
    setRecordingStartedAt(Date.now());
    void browser.runtime
      .sendMessage({ type: REBROADCAST_SESSION_TO_TAB })
      .catch(() => undefined);
    void refresh();
  }, [refresh]);

  let phase: CapturePhase = 'idle';
  if (input.status === 'paused') {
    phase = 'paused';
  } else if (input.status === 'recording') {
    if (startFailed) {
      phase = 'failed';
    } else if (readiness?.reconnecting === true) {
      phase = 'reconnecting';
    } else if (
      readinessMatchesSession(readiness, recordingSessionId) &&
      collectorsReady(readiness)
    ) {
      phase = 'capturing';
    } else {
      phase = 'starting';
    }
  }

  if (
    isActiveSession(input.snapshot) &&
    input.status === 'recording' &&
    readiness !== null &&
    readiness.sessionId !== input.snapshot.id
  ) {
    phase = 'starting';
  }

  const live = { phase, readiness, startFailed, startFailureMessage, tryAgain };
  if (import.meta.env.MODE === 'test') {
    return testModeResult(input);
  }
  return live;
}
