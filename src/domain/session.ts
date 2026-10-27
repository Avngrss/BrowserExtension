import type { SessionTargetFields } from '@/src/domain/session-target';

export type SessionStatus = 'idle' | 'recording' | 'paused' | 'stopped';

export type ActiveSessionSnapshot = {
  id: string;
  startedAt: number;
} & SessionTargetFields &
  (
    | {
        status: 'recording';
        pausedAt: null;
        stoppedAt: null;
      }
    | {
        status: 'paused';
        pausedAt: number;
        stoppedAt: null;
      }
    | {
        status: 'stopped';
        pausedAt: number | null;
        stoppedAt: number;
      }
  );

export type SessionSnapshot =
  | {
      status: 'idle';
    }
  | ActiveSessionSnapshot;

export type SessionCommand = 'start' | 'pause' | 'resume' | 'stop' | 'reset';

export type SessionTransitionError = {
  ok: false;
  error: {
    code: 'INVALID_TRANSITION';
    message: string;
  };
};

export type SessionTransitionSuccess = {
  ok: true;
  state: SessionSnapshot;
};

export type SessionTransitionResult =
  SessionTransitionSuccess | SessionTransitionError;

export function createIdleSessionSnapshot(): SessionSnapshot {
  return { status: 'idle' };
}

export function getSessionStatusLabel(status: SessionStatus): string {
  switch (status) {
    case 'idle':
      return 'Not monitoring';
    case 'recording':
      return 'Recording';
    case 'paused':
      return 'Paused';
    case 'stopped':
      return 'Reviewing';
  }
}

export function isActiveSession(
  snapshot: SessionSnapshot,
): snapshot is ActiveSessionSnapshot {
  return snapshot.status !== 'idle';
}
