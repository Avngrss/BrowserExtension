import type {
  ScreenshotEvidence,
  ScreenshotFailureReason,
  ScreenshotFrame,
  ScreenshotIssueCategory,
  ScreenshotIssueLink,
} from '@/src/domain/screenshot-evidence';
import { buildIssueEvidenceView } from '@/src/domain/screenshot-evidence';
import type { ScreenshotIdbAdapter } from '@/src/screenshots/screenshot-idb';

export class ScreenshotEvidenceStore {
  private frames: ScreenshotFrame[] = [];
  private links: ScreenshotIssueLink[] = [];
  private ready: Promise<void>;

  constructor(private readonly idb: ScreenshotIdbAdapter) {
    this.ready = this.restore();
  }

  waitUntilReady(): Promise<void> {
    return this.ready;
  }

  getFrames(): ScreenshotFrame[] {
    return [...this.frames];
  }

  getLinks(): ScreenshotIssueLink[] {
    return [...this.links];
  }

  getIssueEvidenceList(sessionId?: string): ScreenshotEvidence[] {
    const framesById = new Map(this.frames.map((frame) => [frame.id, frame]));
    const linkCountByFrame = new Map<string, number>();
    for (const link of this.links) {
      linkCountByFrame.set(
        link.screenshotId,
        (linkCountByFrame.get(link.screenshotId) ?? 0) + 1,
      );
    }

    return this.links
      .filter((link) => sessionId === undefined || link.sessionId === sessionId)
      .map((link) => {
        const frame = framesById.get(link.screenshotId);
        if (frame === undefined) {
          return undefined;
        }
        return buildIssueEvidenceView(
          frame,
          link,
          linkCountByFrame.get(link.screenshotId) ?? 1,
        );
      })
      .filter((item): item is ScreenshotEvidence => item !== undefined);
  }

  getRecordsForSession(sessionId: string): ScreenshotEvidence[] {
    return this.getIssueEvidenceList(sessionId);
  }

  getRecords(): ScreenshotEvidence[] {
    return this.getIssueEvidenceList();
  }

  findByIssue(
    issueCategory: ScreenshotIssueCategory,
    issueId: string,
  ): ScreenshotEvidence | undefined {
    return this.getIssueEvidenceList().find(
      (record) =>
        record.issueCategory === issueCategory && record.issueId === issueId,
    );
  }

  findFrame(id: string): ScreenshotFrame | undefined {
    return this.frames.find((frame) => frame.id === id);
  }

  countCapturedFramesForSession(sessionId: string): number {
    return this.frames.filter(
      (frame) => frame.sessionId === sessionId && frame.status === 'captured',
    ).length;
  }

  countPendingFramesForSession(sessionId: string): number {
    return this.frames.filter(
      (frame) =>
        frame.sessionId === sessionId &&
        (frame.status === 'queued' || frame.status === 'pending'),
    ).length;
  }

  hasLink(issueCategory: ScreenshotIssueCategory, issueId: string): boolean {
    return this.links.some(
      (link) =>
        link.issueCategory === issueCategory && link.issueId === issueId,
    );
  }

  async clearSession(): Promise<void> {
    await this.ready;
    this.frames = [];
    this.links = [];
    await this.idb.clearAll();
  }

  async removePendingFramesForSession(sessionId: string): Promise<void> {
    await this.ready;
    const pendingFrameIds = new Set(
      this.frames
        .filter(
          (frame) =>
            frame.sessionId === sessionId &&
            (frame.status === 'queued' || frame.status === 'pending'),
        )
        .map((frame) => frame.id),
    );
    if (pendingFrameIds.size === 0) {
      return;
    }

    const linksToRemove = this.links.filter((link) =>
      pendingFrameIds.has(link.screenshotId),
    );
    this.links = this.links.filter(
      (link) => !pendingFrameIds.has(link.screenshotId),
    );
    for (const link of linksToRemove) {
      await this.idb.deleteLink(
        link.screenshotId,
        link.issueCategory,
        link.issueId,
      );
    }

    const framesToRemove = this.frames.filter((frame) =>
      pendingFrameIds.has(frame.id),
    );
    this.frames = this.frames.filter((frame) => !pendingFrameIds.has(frame.id));
    for (const frame of framesToRemove) {
      await this.idb.deleteFrame(frame.id);
      await this.idb.deleteBlob(frame.storageRef);
    }
  }

  async upsertFrame(frame: ScreenshotFrame): Promise<void> {
    await this.ready;
    const index = this.frames.findIndex((item) => item.id === frame.id);
    if (index >= 0) {
      this.frames[index] = frame;
    } else {
      this.frames.push(frame);
    }
    await this.idb.putFrame(frame);
  }

  async addLink(link: ScreenshotIssueLink): Promise<void> {
    await this.ready;
    if (this.hasLink(link.issueCategory, link.issueId)) {
      return;
    }
    this.links.push(link);
    await this.idb.putLink(link);
  }

  async unlinkIssue(
    issueCategory: ScreenshotIssueCategory,
    issueId: string,
  ): Promise<boolean> {
    await this.ready;
    const link = this.links.find(
      (item) =>
        item.issueCategory === issueCategory && item.issueId === issueId,
    );
    if (link === undefined) {
      return false;
    }

    this.links = this.links.filter(
      (item) =>
        !(
          item.screenshotId === link.screenshotId &&
          item.issueCategory === issueCategory &&
          item.issueId === issueId
        ),
    );
    await this.idb.deleteLink(link.screenshotId, issueCategory, issueId);

    const remaining = this.links.filter(
      (item) => item.screenshotId === link.screenshotId,
    );
    if (remaining.length === 0) {
      const frame = this.frames.find((item) => item.id === link.screenshotId);
      this.frames = this.frames.filter((item) => item.id !== link.screenshotId);
      await this.idb.deleteFrame(link.screenshotId);
      if (frame !== undefined) {
        await this.idb.deleteBlob(frame.storageRef);
      }
    }
    return true;
  }

  async removeIssueEvidence(evidenceId: string): Promise<boolean> {
    const parts = evidenceId.split(':');
    if (parts.length < 3) {
      return false;
    }
    const issueCategory = parts[1];
    const issueId = parts.slice(2).join(':');
    if (
      issueCategory !== 'ui' &&
      issueCategory !== 'console' &&
      issueCategory !== 'network'
    ) {
      return false;
    }
    return this.unlinkIssue(issueCategory, issueId);
  }

  async putBlob(storageRef: string, blob: Blob): Promise<void> {
    await this.ready;
    await this.idb.putBlob(storageRef, blob);
  }

  async getBlob(storageRef: string): Promise<Blob | null> {
    await this.ready;
    return this.idb.getBlob(storageRef);
  }

  createQueuedFrame(input: {
    sessionId: string;
    pageUrl: string | null;
    createId: () => string;
  }): ScreenshotFrame {
    const id = input.createId();
    return {
      id,
      sessionId: input.sessionId,
      capturedAt: Date.now(),
      pageUrl: input.pageUrl,
      width: 0,
      height: 0,
      format: 'jpeg',
      storageRef: id,
      status: 'queued',
    };
  }

  finalizeUnavailable(
    frame: ScreenshotFrame,
    reason: ScreenshotFailureReason,
  ): ScreenshotFrame {
    return {
      ...frame,
      status: 'unavailable',
      failureReason: reason,
      capturedAt: Date.now(),
    };
  }

  finalizeFailed(
    frame: ScreenshotFrame,
    reason: ScreenshotFailureReason,
  ): ScreenshotFrame {
    return {
      ...frame,
      status: 'failed',
      failureReason: reason,
      capturedAt: Date.now(),
    };
  }

  async removeFrameIfEmpty(screenshotId: string): Promise<void> {
    const remaining = this.links.filter(
      (link) => link.screenshotId === screenshotId,
    );
    if (remaining.length > 0) {
      return;
    }
    const frame = this.frames.find((item) => item.id === screenshotId);
    this.frames = this.frames.filter((item) => item.id !== screenshotId);
    await this.idb.deleteFrame(screenshotId);
    if (frame !== undefined) {
      await this.idb.deleteBlob(frame.storageRef);
    }
  }

  private async restore(): Promise<void> {
    try {
      this.frames = await this.idb.getAllFrames();
      this.links = await this.idb.getAllLinks();
    } catch {
      this.frames = [];
      this.links = [];
    }
  }
}
