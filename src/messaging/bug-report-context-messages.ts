import {
  bugReportContextFieldForSave,
  validateBugReportContextField,
} from '@/src/bug-report/bug-report-context-fields';
import type { BugReportContextStore } from '@/src/bug-report/bug-report-context-store';
import { isActiveSession, type SessionSnapshot } from '@/src/domain/session';
import {
  BUG_REPORT_CONTEXT_UPDATED,
  GET_BUG_REPORT_CONTEXT,
  SAVE_BUG_REPORT_CONTEXT,
  type BugReportContextRequestMessage,
  type BugReportContextResponse,
  type BugReportContextUpdatedMessage,
} from '@/src/messaging/bug-report-context-types';
import { browser } from 'wxt/browser';

export function isBugReportContextRequestMessage(
  message: unknown,
): message is BugReportContextRequestMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return false;
  }
  const type = (message as Record<string, unknown>).type;
  return type === GET_BUG_REPORT_CONTEXT || type === SAVE_BUG_REPORT_CONTEXT;
}

export function createBugReportContextUpdatedMessage(
  context: import('@/src/domain/bug-report-context').BugReportContext | null,
): BugReportContextUpdatedMessage {
  return { type: BUG_REPORT_CONTEXT_UPDATED, context };
}

function stoppedSessionForContext(
  state: SessionSnapshot,
): import('@/src/domain/session').ActiveSessionSnapshot | null {
  if (!isActiveSession(state) || state.status !== 'stopped') {
    return null;
  }
  return state;
}

export type BugReportContextHandlerDeps = {
  getSessionState: () => SessionSnapshot;
  bugReportContextStore: BugReportContextStore;
  broadcastBugReportContext: () => void;
};

export async function handleBugReportContextRequestMessage(
  message: BugReportContextRequestMessage,
  deps: BugReportContextHandlerDeps,
): Promise<BugReportContextResponse> {
  const session = deps.getSessionState();
  const stopped = stoppedSessionForContext(session);

  if (message.type === GET_BUG_REPORT_CONTEXT) {
    if (stopped === null || stopped.id !== message.sessionId) {
      return { ok: true, context: null };
    }
    return {
      ok: true,
      context: deps.bugReportContextStore.getContextForSession(
        message.sessionId,
      ),
    };
  }

  if (stopped === null || stopped.id !== message.sessionId) {
    return {
      ok: false,
      error: {
        code: 'INVALID_SESSION',
        message: 'Bug context can only be saved while reviewing a session.',
      },
    };
  }

  const happenedError = validateBugReportContextField(
    message.whatHappened ?? '',
    'What happened?',
  );
  if (happenedError !== undefined) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: happenedError },
    };
  }

  const expectedError = validateBugReportContextField(
    message.whatWasExpected ?? '',
    'What was expected?',
  );
  if (expectedError !== undefined) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: expectedError },
    };
  }

  const context = {
    sessionId: message.sessionId,
    whatHappened: bugReportContextFieldForSave(message.whatHappened),
    whatWasExpected: bugReportContextFieldForSave(message.whatWasExpected),
  };

  await deps.bugReportContextStore.saveContext(context);
  deps.broadcastBugReportContext();
  return { ok: true, context };
}

export function broadcastBugReportContextToRuntime(
  context: import('@/src/domain/bug-report-context').BugReportContext | null,
): void {
  const message = createBugReportContextUpdatedMessage(context);
  void browser.runtime.sendMessage(message).catch(() => undefined);
}
