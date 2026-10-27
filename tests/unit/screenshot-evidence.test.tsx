import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IssueReviewScreenshotEvidence } from '@/src/components/IssueReviewScreenshotEvidence';
import { ScreenshotViewerModal } from '@/src/components/ScreenshotViewerModal';
import type { SessionSnapshot } from '@/src/domain/session';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import { validateScreenshotMaxPerSession } from '@/src/settings/extension-settings';
import {
  processScreenshotDataUrl,
  SCREENSHOT_MAX_WIDTH,
} from '@/src/screenshots/jpeg-process';
import { ScreenshotEvidenceStore } from '@/src/screenshots/screenshot-evidence-store';
import { ConsoleIssueStore } from '@/src/console/console-issue-store';
import { createMockConsoleIssueStorage } from '../helpers/mock-console-issue-storage';
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

describe('screenshot evidence settings', () => {
  it('validates max per session range', () => {
    expect(validateScreenshotMaxPerSession(10)).toBeUndefined();
    expect(validateScreenshotMaxPerSession(0)).toBeTruthy();
    expect(validateScreenshotMaxPerSession(51)).toBeTruthy();
  });
});

describe('IssueReviewScreenshotEvidence', () => {
  it('renders nothing when the issue has no screenshot record', () => {
    const { container } = render(
      <IssueReviewScreenshotEvidence
        category="console"
        issueId="missing"
        disposition="unexpected"
        evidence={[]}
        onRemove={() => Promise.resolve(true)}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Screenshot unavailable/i)).toBeNull();
  });
});

describe('jpeg processing', () => {
  const convertToBlob = vi.fn(() =>
    Promise.resolve(new Blob(['jpeg'], { type: 'image/jpeg' })),
  );

  beforeEach(() => {
    convertToBlob.mockClear();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() =>
        Promise.resolve({
          width: 2000,
          height: 1000,
          close: vi.fn(),
        }),
      ),
    );
    vi.stubGlobal(
      'OffscreenCanvas',
      vi.fn(function OffscreenCanvasMock(width: number, height: number) {
        return {
          getContext: () => ({ drawImage: vi.fn() }),
          convertToBlob,
          width,
          height,
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resizes wide images and emits JPEG', async () => {
    const png = new Blob([Uint8Array.from([137, 80, 78, 71])], {
      type: 'image/png',
    });
    const dataUrl = `data:image/png;base64,${Buffer.from(await png.arrayBuffer()).toString('base64')}`;

    const result = await processScreenshotDataUrl(dataUrl);

    expect(result.width).toBe(SCREENSHOT_MAX_WIDTH);
    expect(result.height).toBe(800);
    expect(result.blob.type).toBe('image/jpeg');
    expect(convertToBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'image/jpeg',
        quality: 0.85,
      }),
    );
  });
});

describe('ScreenshotEvidenceStore', () => {
  it('persists metadata and blobs, clears on session reset, removes both', async () => {
    const idb = createInMemoryScreenshotIdb();
    const store = new ScreenshotEvidenceStore(idb);
    await store.waitUntilReady();

    const frame = store.createQueuedFrame({
      sessionId: 'session-1',
      pageUrl: 'https://example.com/',
      createId: () => 'shot-1',
    });
    await store.upsertFrame(frame);
    await store.addLink({
      screenshotId: 'shot-1',
      issueCategory: 'ui',
      issueId: 'issue-1',
      sessionId: 'session-1',
    });
    await store.putBlob('shot-1', new Blob(['img'], { type: 'image/jpeg' }));

    const captured = {
      ...frame,
      status: 'captured' as const,
      width: 10,
      height: 10,
    };
    await store.upsertFrame(captured);

    expect(await idb.getBlob('shot-1')).not.toBeNull();
    expect(store.findByIssue('ui', 'issue-1')?.status).toBe('captured');

    await store.clearSession();
    expect(store.getRecords()).toHaveLength(0);
    expect(await idb.getBlob('shot-1')).toBeNull();

    await store.upsertFrame(captured);
    await store.addLink({
      screenshotId: 'shot-1',
      issueCategory: 'ui',
      issueId: 'issue-1',
      sessionId: 'session-1',
    });
    await store.putBlob('shot-1', new Blob(['img'], { type: 'image/jpeg' }));
    expect(await store.unlinkIssue('ui', 'issue-1')).toBe(true);
    expect(await idb.getBlob('shot-1')).toBeNull();
    expect(await idb.getFrame('shot-1')).toBeNull();
  });

  it('tolerates missing blobs when reading', async () => {
    const idb = createInMemoryScreenshotIdb();
    const store = new ScreenshotEvidenceStore(idb);
    await store.waitUntilReady();

    const frame = store.createQueuedFrame({
      sessionId: 'session-1',
      pageUrl: null,
      createId: () => 'shot-2',
    });
    await store.upsertFrame({
      ...frame,
      status: 'captured',
      width: 1,
      height: 1,
    });
    await store.addLink({
      screenshotId: 'shot-2',
      issueCategory: 'console',
      issueId: 'issue-2',
      sessionId: 'session-1',
    });
    idb.corruptBlob('shot-2');

    expect(await store.getBlob('shot-2')).toBeNull();
    expect(store.getRecords()).toHaveLength(1);
  });
});

describe('capture-visible-tab-errors', () => {
  it('maps browser rate limit messages to capture-rate-limited', async () => {
    const { classifyCaptureVisibleTabError } =
      await import('@/src/screenshots/capture-visible-tab-errors');
    expect(
      classifyCaptureVisibleTabError(
        new Error('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND'),
      ),
    ).toBe('capture-rate-limited');
  });
});

describe('legacy screenshot evidence view', () => {
  it('builds per-issue evidence from frame and link', async () => {
    const { buildIssueEvidenceView } =
      await import('@/src/domain/screenshot-evidence');
    const view = buildIssueEvidenceView(
      {
        id: 'frame-1',
        sessionId: 'session-1',
        capturedAt: 1,
        pageUrl: 'https://example.com/',
        width: 10,
        height: 10,
        format: 'jpeg',
        storageRef: 'frame-1',
        status: 'captured',
      },
      {
        screenshotId: 'frame-1',
        issueCategory: 'ui',
        issueId: 'issue-1',
        sessionId: 'session-1',
      },
      2,
    );
    expect(view.linkedIssueCount).toBe(2);
    expect(view.id).toContain('frame-1');
  });
});

describe('console issue store screenshot hook', () => {
  it('notifies only for new unique console issues', async () => {
    const events: Array<{ issueCategory: string; issueId: string }> = [];
    let id = 0;
    const store = new ConsoleIssueStore(createMockConsoleIssueStorage(), {
      getSessionState: () => recordingSession,
      createIssueId: () => `issue-${++id}`,
      onNewUniqueIssue: (event) => {
        events.push(event);
      },
    });
    await store.waitUntilReady();

    const payload = {
      sessionId: 'session-1',
      timestamp: 2_000,
      category: 'console-error' as const,
      message: 'Unique console',
      url: 'https://example.com/',
    };

    await store.submitIssue(payload, DEFAULT_TEST_SESSION_TARGET.targetTabId);
    await store.submitIssue(payload, DEFAULT_TEST_SESSION_TARGET.targetTabId);

    expect(events).toHaveLength(1);
    expect(events[0]?.issueCategory).toBe('console');
  });
});

describe('ScreenshotViewerModal', () => {
  it('closes via button, Escape, and backdrop', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const url = URL.createObjectURL(new Blob(['x'], { type: 'image/jpeg' }));

    render(
      <ScreenshotViewerModal
        imageUrl={url}
        alt="Test shot"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    await user.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(1);

    revoke.mockRestore();
    URL.revokeObjectURL(url);
  });
});

describe('object URL hygiene', () => {
  it('revokes object URLs after use', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const url = URL.createObjectURL(new Blob(['x'], { type: 'image/jpeg' }));
    URL.revokeObjectURL(url);
    expect(revoke).toHaveBeenCalledWith(url);
    revoke.mockRestore();
  });
});
