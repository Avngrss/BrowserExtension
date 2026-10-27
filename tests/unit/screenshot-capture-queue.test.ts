import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionSnapshot } from '@/src/domain/session';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import {
  DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS,
  type ScreenshotEvidenceSettings,
} from '@/src/settings/extension-settings';
import {
  SCREENSHOT_GROUPING_WINDOW_MS,
  SCREENSHOT_MIN_CAPTURE_INTERVAL_MS,
  ScreenshotCaptureQueue,
} from '@/src/screenshots/screenshot-capture-queue';
import { ScreenshotEvidenceStore } from '@/src/screenshots/screenshot-evidence-store';
import { createInMemoryScreenshotIdb } from '../helpers/in-memory-screenshot-idb';

const recordingSession: SessionSnapshot = {
  status: 'recording',
  id: 'session-1',
  startedAt: 1_000,
  pausedAt: null,
  stoppedAt: null,
  pageContextUpdatedAt: 1_000,
  ...DEFAULT_TEST_SESSION_TARGET,
};

const browserTabsMock = vi.hoisted(() => ({
  get: vi.fn(),
  query: vi.fn(),
  captureVisibleTab: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: { tabs: browserTabsMock },
}));

vi.mock('@/src/screenshots/jpeg-process', () => ({
  processScreenshotDataUrl: vi.fn(() =>
    Promise.resolve({
      blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
      width: 100,
      height: 50,
    }),
  ),
}));

const ALL_CATEGORY_SCREENSHOT_SETTINGS: ScreenshotEvidenceSettings = {
  ...DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS,
  consoleIssues: true,
  networkIssues: true,
};

describe('ScreenshotCaptureQueue', () => {
  let store: ScreenshotEvidenceStore;
  let queue: ScreenshotCaptureQueue;
  let session: SessionSnapshot;

  beforeEach(async () => {
    vi.useFakeTimers();
    browserTabsMock.get.mockReset();
    browserTabsMock.query.mockReset();
    browserTabsMock.captureVisibleTab.mockReset();
    session = { ...recordingSession };

    browserTabsMock.get.mockResolvedValue({
      id: DEFAULT_TEST_SESSION_TARGET.targetTabId,
      active: true,
      windowId: 1,
      url: 'https://example.com/page',
    });
    browserTabsMock.query.mockResolvedValue([
      { id: DEFAULT_TEST_SESSION_TARGET.targetTabId, active: true },
    ]);
    browserTabsMock.captureVisibleTab.mockResolvedValue(
      'data:image/jpeg;base64,abc',
    );

    const idb = createInMemoryScreenshotIdb();
    store = new ScreenshotEvidenceStore(idb);
    await store.waitUntilReady();

    queue = new ScreenshotCaptureQueue(store, {
      getSessionState: () => session,
      getSettings: () => ({ ...DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS }),
      sanitizePageUrl: (url) => url,
      createScreenshotId: () => crypto.randomUUID(),
      onEvidenceChanged: vi.fn(),
    });
    queue.onNewSession('session-1');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function flushCaptures(): Promise<void> {
    await vi.advanceTimersByTimeAsync(SCREENSHOT_GROUPING_WINDOW_MS + 50);
    await vi.advanceTimersByTimeAsync(SCREENSHOT_MIN_CAPTURE_INTERVAL_MS + 100);
    await Promise.resolve();
  }

  function replaceQueue(
    screenshotSettings: ScreenshotEvidenceSettings = DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS,
  ): void {
    queue = new ScreenshotCaptureQueue(store, {
      getSessionState: () => session,
      getSettings: () => ({ ...screenshotSettings }),
      sanitizePageUrl: (url) => url,
      createScreenshotId: () => crypto.randomUUID(),
      onEvidenceChanged: vi.fn(),
    });
    queue.onNewSession('session-1');
  }

  it('with default settings captures UI only and skips console and network', async () => {
    void queue.requestCaptureForIssue({
      issueCategory: 'console',
      issueId: 'c-default-off',
    });
    void queue.requestCaptureForIssue({
      issueCategory: 'network',
      issueId: 'n-default-off',
    });
    void queue.requestCaptureForIssue({
      issueCategory: 'ui',
      issueId: 'ui-default-on',
    });
    await flushCaptures();

    expect(store.getIssueEvidenceList('session-1')).toHaveLength(1);
    expect(store.findByIssue('console', 'c-default-off')).toBeUndefined();
    expect(store.findByIssue('network', 'n-default-off')).toBeUndefined();
    expect(store.findByIssue('ui', 'ui-default-on')?.status).toBe('captured');
    expect(browserTabsMock.captureVisibleTab).toHaveBeenCalledTimes(1);
  });

  it('captures console and network when those settings are enabled', async () => {
    replaceQueue({
      ...DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS,
      consoleIssues: true,
      networkIssues: true,
    });

    void queue.requestCaptureForIssue({
      issueCategory: 'console',
      issueId: 'c-enabled',
    });
    await flushCaptures();
    await vi.advanceTimersByTimeAsync(SCREENSHOT_MIN_CAPTURE_INTERVAL_MS + 100);

    void queue.requestCaptureForIssue({
      issueCategory: 'network',
      issueId: 'n-enabled',
    });
    await flushCaptures();

    expect(store.findByIssue('console', 'c-enabled')?.status).toBe('captured');
    expect(store.findByIssue('network', 'n-enabled')?.status).toBe('captured');
  });

  it('executes captureVisibleTab sequentially, not concurrently', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    browserTabsMock.captureVisibleTab.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => {
        setTimeout(resolve, 40);
      });
      inFlight -= 1;
      return 'data:image/jpeg;base64,abc';
    });

    void queue.requestCaptureForIssue({
      issueCategory: 'ui',
      issueId: 'ui-1',
    });
    void queue.requestCaptureForIssue({
      issueCategory: 'console',
      issueId: 'c-1',
    });
    await flushCaptures();
    await vi.advanceTimersByTimeAsync(SCREENSHOT_GROUPING_WINDOW_MS + 50);
    await vi.advanceTimersByTimeAsync(SCREENSHOT_MIN_CAPTURE_INTERVAL_MS + 200);

    expect(maxInFlight).toBeLessThanOrEqual(1);
    expect(browserTabsMock.captureVisibleTab.mock.calls.length).toBeGreaterThan(
      0,
    );
  });

  it('groups concurrent burst issues into one frame', async () => {
    replaceQueue(ALL_CATEGORY_SCREENSHOT_SETTINGS);
    await Promise.all([
      queue.requestCaptureForIssue({
        issueCategory: 'ui',
        issueId: 'ui-1',
      }),
      queue.requestCaptureForIssue({
        issueCategory: 'console',
        issueId: 'c-1',
      }),
      queue.requestCaptureForIssue({
        issueCategory: 'network',
        issueId: 'n-1',
      }),
    ]);
    await flushCaptures();

    const evidence = store.getIssueEvidenceList('session-1');
    expect(evidence).toHaveLength(3);
    expect(new Set(evidence.map((item) => item.frameId)).size).toBe(1);
    expect(store.countCapturedFramesForSession('session-1')).toBe(1);
    expect(browserTabsMock.captureVisibleTab).toHaveBeenCalledTimes(1);
  });

  it('groups burst issues into one frame and shared blob', async () => {
    replaceQueue(ALL_CATEGORY_SCREENSHOT_SETTINGS);
    void queue.requestCaptureForIssue({
      issueCategory: 'ui',
      issueId: 'ui-1',
    });
    await vi.advanceTimersByTimeAsync(50);
    void queue.requestCaptureForIssue({
      issueCategory: 'console',
      issueId: 'c-1',
    });
    await flushCaptures();

    const evidence = store.getIssueEvidenceList('session-1');
    expect(evidence).toHaveLength(2);
    expect(evidence[0]?.frameId).toBe(evidence[1]?.frameId);
    expect(store.countCapturedFramesForSession('session-1')).toBe(1);
    expect(browserTabsMock.captureVisibleTab).toHaveBeenCalledTimes(1);
  });

  it('classifies browser rate limits and retries without duplicate frames', async () => {
    browserTabsMock.captureVisibleTab
      .mockRejectedValueOnce(new Error('MAX_CAPTURE_VISIBLE_TAB_CALLS'))
      .mockResolvedValueOnce('data:image/jpeg;base64,abc');

    void queue.requestCaptureForIssue({
      issueCategory: 'ui',
      issueId: 'ui-rate',
    });
    await flushCaptures();
    await vi.advanceTimersByTimeAsync(2_000);

    const evidence = store.findByIssue('ui', 'ui-rate');
    expect(evidence?.status).toBe('captured');
    expect(store.getFrames()).toHaveLength(1);
    expect(browserTabsMock.captureVisibleTab.mock.calls.length).toBe(2);
  });

  it('cancels queued work for a previous session on new session', async () => {
    await queue.requestCaptureForIssue({
      issueCategory: 'ui',
      issueId: 'ui-old',
    });
    queue.onNewSession('session-2');
    session = {
      ...recordingSession,
      id: 'session-2',
    };
    await flushCaptures();

    expect(store.findByIssue('ui', 'ui-old')).toBeUndefined();
  });

  it('continues the queue after captured frame storage failure', async () => {
    const upsertFrame = store.upsertFrame.bind(store);
    let capturedWrites = 0;
    store.upsertFrame = async (frame) => {
      if (frame.status === 'captured') {
        capturedWrites += 1;
        if (capturedWrites === 1) {
          throw new Error('idb frame failed');
        }
      }
      return upsertFrame(frame);
    };

    void queue.requestCaptureForIssue({
      issueCategory: 'ui',
      issueId: 'ui-fail',
    });
    await flushCaptures();

    void queue.requestCaptureForIssue({
      issueCategory: 'ui',
      issueId: 'ui-ok',
    });
    await flushCaptures();
    await vi.advanceTimersByTimeAsync(SCREENSHOT_MIN_CAPTURE_INTERVAL_MS + 300);

    expect(store.findByIssue('ui', 'ui-fail')?.status).toBe('failed');
    expect(store.findByIssue('ui', 'ui-ok')?.status).toBe('captured');
    expect(queue.getCaptureInFlightForTests()).toBe(false);
  });

  it('continues the queue after blob storage failure', async () => {
    const idb = createInMemoryScreenshotIdb();
    const failingStore = new ScreenshotEvidenceStore(idb);
    await failingStore.waitUntilReady();
    const putBlob = failingStore.putBlob.bind(failingStore);
    let blobWrites = 0;
    failingStore.putBlob = async (storageRef, blob) => {
      blobWrites += 1;
      if (blobWrites === 1) {
        throw new Error('idb blob failed');
      }
      return putBlob(storageRef, blob);
    };

    const failingQueue = new ScreenshotCaptureQueue(failingStore, {
      getSessionState: () => session,
      getSettings: () => ({ ...DEFAULT_SCREENSHOT_EVIDENCE_SETTINGS }),
      sanitizePageUrl: (url) => url,
      createScreenshotId: () => crypto.randomUUID(),
      onEvidenceChanged: vi.fn(),
    });
    failingQueue.onNewSession('session-1');

    void failingQueue.requestCaptureForIssue({
      issueCategory: 'ui',
      issueId: 'ui-fail',
    });
    await flushCaptures();

    void failingQueue.requestCaptureForIssue({
      issueCategory: 'ui',
      issueId: 'ui-ok',
    });
    await flushCaptures();
    await vi.advanceTimersByTimeAsync(SCREENSHOT_MIN_CAPTURE_INTERVAL_MS + 300);

    expect(failingStore.findByIssue('ui', 'ui-fail')?.status).toBe('failed');
    expect(failingStore.findByIssue('ui', 'ui-ok')?.status).toBe('captured');
    expect(failingQueue.getCaptureInFlightForTests()).toBe(false);
  });

  it('unlinks one issue but keeps shared blob for remaining links', async () => {
    replaceQueue(ALL_CATEGORY_SCREENSHOT_SETTINGS);
    void queue.requestCaptureForIssue({
      issueCategory: 'ui',
      issueId: 'ui-a',
    });
    await vi.advanceTimersByTimeAsync(50);
    void queue.requestCaptureForIssue({
      issueCategory: 'network',
      issueId: 'n-a',
    });
    await flushCaptures();

    const uiEvidence = store.findByIssue('ui', 'ui-a');
    expect(uiEvidence).toBeDefined();
    await store.unlinkIssue('ui', 'ui-a');

    const networkEvidence = store.findByIssue('network', 'n-a');
    expect(networkEvidence?.status).toBe('captured');
    expect(store.getFrames()).toHaveLength(1);
  });
});
