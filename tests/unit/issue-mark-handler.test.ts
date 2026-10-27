import { describe, expect, it, vi } from 'vitest';
import { InMemorySessionStore } from '@/src/sessions/in-memory-session-store';
import { IssueMarkStore } from '@/src/issue-marks/issue-mark-store';
import { handleIssueMarkRequestMessage } from '@/src/messaging/issue-mark-messages';
import { createTestActionStore } from '../helpers/test-action-store';
import { createTestConsoleIssueStore } from '../helpers/test-console-issue-store';
import { createTestNetworkIssueStore } from '../helpers/test-network-issue-store';
import {
  createTestUiIssueStore,
  createTestUiRuleStore,
} from '../helpers/test-ui-issue-store';
import { ScreenshotEvidenceStore } from '@/src/screenshots/screenshot-evidence-store';
import { createInMemoryScreenshotIdb } from '../helpers/in-memory-screenshot-idb';
import { ScreenshotCaptureService } from '@/src/screenshots/screenshot-capture-service';
import { ScreenshotCaptureQueue } from '@/src/screenshots/screenshot-capture-queue';
import { DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS } from '@/src/settings/extension-settings';

describe('issue mark handler', () => {
  it('saves a mark even when screenshot capture fails', async () => {
    const store = new InMemorySessionStore({
      createId: () => 'session-1',
      now: () => 5_000,
    });
    store.execute('start');
    const actionStore = createTestActionStore(() => store.getState());
    const uiRuleStore = createTestUiRuleStore();
    const uiIssueStore = createTestUiIssueStore(
      () => store.getState(),
      uiRuleStore,
    );
    const consoleIssueStore = createTestConsoleIssueStore(() =>
      store.getState(),
    );
    const networkIssueStore = createTestNetworkIssueStore(() =>
      store.getState(),
    );
    const markStore = new IssueMarkStore({
      read: () => Promise.resolve(undefined),
      write: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    });
    await markStore.waitUntilReady();

    const screenshotStore = new ScreenshotEvidenceStore(
      createInMemoryScreenshotIdb(),
    );
    await screenshotStore.waitUntilReady();
    const screenshotCapture = new ScreenshotCaptureService(
      new ScreenshotCaptureQueue(screenshotStore, {
        getSessionState: () => store.getState(),
        getSettings: () => DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS,
        sanitizePageUrl: (url) => url,
        createScreenshotId: () => 'shot-1',
        onEvidenceChanged: () => undefined,
      }),
    );

    const requestCaptureForMark = vi
      .spyOn(screenshotCapture, 'requestCaptureForMark')
      .mockRejectedValue(new Error('capture failed'));

    const response = await handleIssueMarkRequestMessage(
      { type: 'SAVE_ISSUE_MARK', note: 'Broken flow', replaceExisting: false },
      {
        getSessionState: () => store.getState(),
        sanitizePageUrl: (url) => url,
        issueMarkStore: markStore,
        actionStore,
        consoleIssueStore,
        networkIssueStore,
        uiIssueStore,
        screenshotCapture,
        screenshotStore,
        broadcastIssueMark: () => undefined,
      },
    );

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.mark?.note).toBe('Broken flow');
      expect(response.data.mark?.sessionId).toBe('session-1');
    }
    expect(requestCaptureForMark).toHaveBeenCalled();
  });
});
