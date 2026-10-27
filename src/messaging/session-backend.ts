import type { SessionCommand } from '@/src/domain/session';
import type { SessionResponse } from '@/src/messaging/session-types';

export type SessionBackend = {
  getSessionState(): Promise<SessionResponse>;
  runSessionCommand(
    command: SessionCommand,
    targetTabId?: number,
  ): Promise<SessionResponse>;
  startNewCapture(targetTabId?: number): Promise<SessionResponse>;
  deleteSession(): Promise<SessionResponse>;
};
