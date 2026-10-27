import {
  issueMarkNoteForSave,
  validateIssueMarkNote,
} from '@/src/issue-marks/issue-mark-note';
import type { PotentialBugCoordinator } from '@/src/potential-bugs/potential-bug-coordinator';
import type { PotentialBugStore } from '@/src/potential-bugs/potential-bug-store';
import {
  CAPTURE_BUG_NOW,
  GET_POTENTIAL_BUGS,
  SET_POTENTIAL_BUG_STATUS,
  type PotentialBugRequestMessage,
  type PotentialBugResponse,
} from '@/src/messaging/potential-bug-types';

export type PotentialBugHandlerDeps = {
  store: PotentialBugStore;
  coordinator: PotentialBugCoordinator;
  getActiveSessionId: () => string | undefined;
  broadcastPotentialBugs: () => void;
};

export function isPotentialBugRequestMessage(
  message: unknown,
): message is PotentialBugRequestMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return false;
  }
  const record = message as Record<string, unknown>;
  if (record.type === GET_POTENTIAL_BUGS) {
    return true;
  }
  if (record.type === CAPTURE_BUG_NOW) {
    return record.note === undefined || typeof record.note === 'string';
  }
  if (record.type === SET_POTENTIAL_BUG_STATUS) {
    return (
      typeof record.bugId === 'string' &&
      (record.status === 'included' || record.status === 'excluded')
    );
  }
  return false;
}

function sessionBugs(deps: PotentialBugHandlerDeps) {
  const sessionId = deps.getActiveSessionId();
  return sessionId === undefined ? [] : deps.store.getBugsForSession(sessionId);
}

export async function handlePotentialBugRequestMessage(
  message: PotentialBugRequestMessage,
  deps: PotentialBugHandlerDeps,
): Promise<PotentialBugResponse> {
  await deps.store.waitUntilReady();

  if (message.type === GET_POTENTIAL_BUGS) {
    return { ok: true, bugs: sessionBugs(deps) };
  }

  if (message.type === SET_POTENTIAL_BUG_STATUS) {
    const updated = await deps.store.setStatus(message.bugId, message.status);
    if (!updated) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Potential bug not found.' },
      };
    }
    deps.broadcastPotentialBugs();
    return { ok: true, bugs: sessionBugs(deps) };
  }

  const noteError = validateIssueMarkNote(message.note ?? '');
  if (noteError !== undefined) {
    return { ok: false, error: { code: 'INVALID_NOTE', message: noteError } };
  }
  const result = await deps.coordinator.captureManual({
    note: issueMarkNoteForSave(message.note),
  });
  if (!result.ok) {
    return { ok: false, error: { code: result.code, message: result.message } };
  }
  return { ok: true, bugs: sessionBugs(deps) };
}
