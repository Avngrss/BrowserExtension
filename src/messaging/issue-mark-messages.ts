import type { ActionStore } from '@/src/actions/action-store';
import type { ConsoleIssueStore } from '@/src/console/console-issue-store';
import {
  ISSUE_MARK_SCREENSHOT_ISSUE_ID,
  type IssueMark,
} from '@/src/domain/issue-mark';
import { isActiveSession, type SessionSnapshot } from '@/src/domain/session';
import { buildIssueMarkContext } from '@/src/issue-marks/build-issue-mark-context';
import {
  issueMarkNoteForSave,
  validateIssueMarkNote,
} from '@/src/issue-marks/issue-mark-note';
import type { IssueMarkStore } from '@/src/issue-marks/issue-mark-store';
import type { NetworkIssueStore } from '@/src/network/network-issue-store';
import {
  GET_ISSUE_MARK,
  ISSUE_MARK_UPDATED,
  SAVE_ISSUE_MARK,
  SET_ISSUE_MARK_REPORT_SCOPE,
  SET_REPORT_SCOPE_WITHOUT_MARK,
  type GetIssueMarkMessage,
  type IssueMarkRequestMessage,
  type IssueMarkResponse,
  type IssueMarkUpdatedMessage,
  type SaveIssueMarkMessage,
} from '@/src/messaging/issue-mark-types';
import type { ScreenshotCaptureService } from '@/src/screenshots/screenshot-capture-service';
import type { ScreenshotEvidenceStore } from '@/src/screenshots/screenshot-evidence-store';
import type { UiIssueStore } from '@/src/ui/ui-issue-store';
import { browser } from 'wxt/browser';

export function isIssueMarkRequestMessage(
  message: unknown,
): message is IssueMarkRequestMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return false;
  }
  const type = (message as Record<string, unknown>).type;
  return (
    type === GET_ISSUE_MARK ||
    type === SAVE_ISSUE_MARK ||
    type === SET_ISSUE_MARK_REPORT_SCOPE ||
    type === SET_REPORT_SCOPE_WITHOUT_MARK
  );
}

export function createIssueMarkUpdatedMessage(
  data: import('@/src/domain/issue-mark').IssueMarkSessionData,
): IssueMarkUpdatedMessage {
  return { type: ISSUE_MARK_UPDATED, data };
}

function activeRecordingSession(
  state: SessionSnapshot,
): import('@/src/domain/session').ActiveSessionSnapshot | null {
  if (!isActiveSession(state)) {
    return null;
  }
  if (state.status !== 'recording' && state.status !== 'paused') {
    return null;
  }
  return state;
}

export type IssueMarkHandlerDeps = {
  getSessionState: () => SessionSnapshot;
  sanitizePageUrl: (url: string) => string | null;
  issueMarkStore: IssueMarkStore;
  actionStore: ActionStore;
  consoleIssueStore: ConsoleIssueStore;
  networkIssueStore: NetworkIssueStore;
  uiIssueStore: UiIssueStore;
  screenshotCapture: ScreenshotCaptureService;
  screenshotStore: ScreenshotEvidenceStore;
  broadcastIssueMark: () => void;
};

export async function handleIssueMarkRequestMessage(
  message: IssueMarkRequestMessage,
  deps: IssueMarkHandlerDeps,
): Promise<IssueMarkResponse> {
  await deps.issueMarkStore.waitUntilReady();

  if (message.type === GET_ISSUE_MARK) {
    return { ok: true, data: deps.issueMarkStore.getData() };
  }

  if (message.type === SET_ISSUE_MARK_REPORT_SCOPE) {
    await deps.issueMarkStore.setReportScope(message.scope);
    deps.broadcastIssueMark();
    return { ok: true, data: deps.issueMarkStore.getData() };
  }

  if (message.type === SET_REPORT_SCOPE_WITHOUT_MARK) {
    await deps.issueMarkStore.setReportScopeWithoutMark(message.scope);
    deps.broadcastIssueMark();
    return { ok: true, data: deps.issueMarkStore.getData() };
  }

  return handleSaveIssueMark(message, deps);
}

async function handleSaveIssueMark(
  message: SaveIssueMarkMessage,
  deps: IssueMarkHandlerDeps,
): Promise<IssueMarkResponse> {
  const session = activeRecordingSession(deps.getSessionState());
  if (session === null) {
    return {
      ok: false,
      error: {
        code: 'NO_ACTIVE_SESSION',
        message: 'Start capture before marking an issue.',
      },
    };
  }

  const noteRaw = message.note ?? '';
  const noteError = validateIssueMarkNote(noteRaw);
  if (noteError !== undefined) {
    return {
      ok: false,
      error: { code: 'INVALID_NOTE', message: noteError },
    };
  }

  const existing = deps.issueMarkStore.getMarkForSession(session.id);
  if (existing !== null && !message.replaceExisting) {
    return {
      ok: false,
      error: {
        code: 'MARK_EXISTS',
        message: 'A mark already exists for this session.',
      },
    };
  }

  const sanitizedUrl = deps.sanitizePageUrl(session.targetUrl);
  if (sanitizedUrl === null) {
    return {
      ok: false,
      error: {
        code: 'NO_ACTIVE_SESSION',
        message: 'The monitored page URL is unavailable.',
      },
    };
  }

  const markedAt = Date.now();
  const context = buildIssueMarkContext({
    session,
    markedAt,
    sanitizedPageUrl: sanitizedUrl,
    actions: deps.actionStore.getActions(),
    uiIssues: deps.uiIssueStore.getIssues(),
    consoleIssues: deps.consoleIssueStore.getIssues(),
    networkIssues: deps.networkIssueStore.getIssues(),
  });

  if (existing !== null && message.replaceExisting) {
    await removeMarkScreenshot(deps, session.id);
  }

  const mark: IssueMark = {
    sessionId: session.id,
    markedAt,
    note: issueMarkNoteForSave(message.note),
    pageUrl: context.pageUrl,
    pageTitle: context.pageTitle,
    pathname: context.pathname,
    actionIds: context.actionIds,
    relatedIssues: context.relatedIssues,
    reportScope: existing?.reportScope ?? 'around-mark',
  };

  try {
    await deps.issueMarkStore.saveMark(mark);
  } catch {
    return {
      ok: false,
      error: {
        code: 'STORAGE_ERROR',
        message: 'Could not save the issue mark.',
      },
    };
  }

  void deps.screenshotCapture.requestCaptureForMark().catch(() => undefined);
  deps.broadcastIssueMark();
  return { ok: true, data: deps.issueMarkStore.getData() };
}

async function removeMarkScreenshot(
  deps: IssueMarkHandlerDeps,
  sessionId: string,
): Promise<void> {
  const record = deps.screenshotStore
    .getRecordsForSession(sessionId)
    .find(
      (item) =>
        item.issueCategory === 'mark' &&
        item.issueId === ISSUE_MARK_SCREENSHOT_ISSUE_ID,
    );
  if (record !== undefined) {
    await deps.screenshotCapture.removeScreenshot(record.id);
  }
}

export function broadcastIssueMarkUpdated(
  data: import('@/src/domain/issue-mark').IssueMarkSessionData,
): void {
  const message = createIssueMarkUpdatedMessage(data);
  void browser.runtime.sendMessage(message).catch(() => undefined);
}

export type { SaveIssueMarkMessage, GetIssueMarkMessage };
