import { useCallback, useEffect, useState } from 'react';
import {
  getSessionStatusLabel,
  type SessionSnapshot,
  type SessionStatus,
} from '@/src/domain/session';
import {
  SESSION_SYNC_FAILED_MESSAGE,
  sessionClient,
} from '@/src/utils/session-client';

export type UseSessionStateResult = {
  snapshot: SessionSnapshot;
  status: SessionStatus;
  statusLabel: string;
  loading: boolean;
  processing: boolean;
  error: string | undefined;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  startNewCapture: () => Promise<void>;
  deleteSession: () => Promise<void>;
};

function idleSnapshot(): SessionSnapshot {
  return { status: 'idle' };
}

export function useSessionState(): UseSessionStateResult {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(idleSnapshot());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const applyResponse = useCallback(
    (response: Awaited<ReturnType<typeof sessionClient.getState>>) => {
      if (!response.ok) {
        setError(response.error.message);
        return;
      }

      setSnapshot(response.state);
      setError(undefined);
    },
    [],
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const response = await sessionClient.getState();
      if (!active) {
        return;
      }

      if (!response.ok) {
        setError(SESSION_SYNC_FAILED_MESSAGE);
        setLoading(false);
        return;
      }

      setSnapshot(response.state);
      setLoading(false);
    })();

    const unsubscribe = sessionClient.subscribe((state) => {
      if (active) {
        setSnapshot(state);
        setError(undefined);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const runCommand = useCallback(
    async (
      command: () => Promise<
        Awaited<ReturnType<typeof sessionClient.getState>>
      >,
    ) => {
      if (processing || loading) {
        return;
      }

      setProcessing(true);
      setError(undefined);

      const response = await command();
      setProcessing(false);
      applyResponse(response);

      if (!response.ok) {
        return;
      }
    },
    [applyResponse, loading, processing],
  );

  return {
    snapshot,
    status: snapshot.status,
    statusLabel: getSessionStatusLabel(snapshot.status),
    loading,
    processing,
    error,
    start: () => runCommand(() => sessionClient.start()),
    pause: () => runCommand(() => sessionClient.pause()),
    resume: () => runCommand(() => sessionClient.resume()),
    stop: () => runCommand(() => sessionClient.stop()),
    startNewCapture: () => runCommand(() => sessionClient.startNewCapture()),
    deleteSession: () => runCommand(() => sessionClient.deleteSession()),
  };
}
