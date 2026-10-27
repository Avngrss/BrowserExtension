import type {
  ActiveSessionSnapshot,
  SessionSnapshot,
} from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';
import type {
  ScreenshotFailureReason,
  ScreenshotIssueCategory,
} from '@/src/domain/screenshot-evidence';
import {
  classifyCaptureVisibleTabError,
  isBrowserCaptureRateLimitReason,
} from '@/src/screenshots/capture-visible-tab-errors';
import { processScreenshotDataUrl } from '@/src/screenshots/jpeg-process';
import { resolveMonitoredTabForCapture } from '@/src/screenshots/monitored-tab-capture';
import type { ScreenshotEvidenceStore } from '@/src/screenshots/screenshot-evidence-store';
import type { ScreenshotEvidenceSettings } from '@/src/settings/extension-settings';
import { browser } from 'wxt/browser';

export const SCREENSHOT_GROUPING_WINDOW_MS = 400;
export const SCREENSHOT_MIN_CAPTURE_INTERVAL_MS = 550;
const RATE_LIMIT_MAX_RETRIES = 2;
const RATE_LIMIT_BACKOFF_MS = [700, 1_400] as const;

type IssueRef = {
  issueCategory: ScreenshotIssueCategory;
  issueId: string;
};

type OpenCaptureGroup = {
  sessionId: string;
  targetTabId: number;
  pageUrl: string | null;
  frameId: string;
  issues: IssueRef[];
  timer: ReturnType<typeof setTimeout> | null;
};

type CaptureJob = {
  sessionId: string;
  targetTabId: number;
  pageUrl: string | null;
  frameId: string;
  issues: IssueRef[];
  rateLimitAttempt: number;
};

export type ScreenshotCaptureQueueDeps = {
  getSessionState: () => SessionSnapshot;
  getSettings: () => ScreenshotEvidenceSettings;
  sanitizePageUrl: (url: string) => string | null;
  createScreenshotId: () => string;
  onEvidenceChanged: () => void;
};

export class ScreenshotCaptureQueue {
  private openGroup: OpenCaptureGroup | null = null;
  private readonly pendingJobs: CaptureJob[] = [];
  private processing = false;
  private captureInFlight = false;
  private lastCaptureFinishedAt = 0;
  private activeSessionId: string | null = null;
  private readonly queuedIssueKeys = new Set<string>();
  private enqueueChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: ScreenshotEvidenceStore,
    private readonly deps: ScreenshotCaptureQueueDeps,
  ) {}

  discardSession(sessionId: string): void {
    this.cancelSessionWork(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
  }

  onNewSession(sessionId: string): void {
    const previous = this.activeSessionId;
    this.activeSessionId = sessionId;
    this.cancelSessionWork(previous);
    if (previous !== null && previous !== sessionId) {
      void this.store.removePendingFramesForSession(previous).then(() => {
        this.deps.onEvidenceChanged();
      });
    }
  }

  onRecordingStopped(): void {
    void this.flushOpenGroupAsync();
  }

  async requestCaptureForSessionMark(issueId: string): Promise<void> {
    await this.requestCaptureForIssue({
      issueCategory: 'mark',
      issueId,
    });
  }

  async requestCaptureForIssue(input: IssueRef): Promise<void> {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.enqueueChain;
    this.enqueueChain = previous.then(() => gate);
    await previous;
    try {
      await this.requestCaptureForIssueInner(input);
    } finally {
      release();
    }
  }

  private async requestCaptureForIssueInner(input: IssueRef): Promise<void> {
    const session = this.deps.getSessionState();
    if (!this.canAcceptNewScreenshotRequest(session)) {
      return;
    }
    const requestSessionId = session.id;

    const settings = this.deps.getSettings();
    if (input.issueCategory !== 'mark') {
      if (!settings.captureAutomatically) {
        return;
      }
      if (!isCategoryEnabled(settings, input.issueCategory)) {
        return;
      }
    }

    const issueKey = issueKeyFor(input, requestSessionId);
    if (
      this.store.hasLink(input.issueCategory, input.issueId) ||
      this.queuedIssueKeys.has(issueKey)
    ) {
      return;
    }

    const pageUrl = this.deps.sanitizePageUrl(session.targetUrl);
    const targetTabId = session.targetTabId;

    if (
      this.openGroup !== null &&
      canJoinOpenGroup(this.openGroup, {
        sessionId: requestSessionId,
        targetTabId,
        pageUrl,
      })
    ) {
      if (!this.canAcceptNewScreenshotRequestForId(requestSessionId)) {
        return;
      }
      await this.attachIssueToGroup(this.openGroup, input, issueKey);
      this.scheduleGroupFlush(this.openGroup);
      return;
    }

    await this.flushOpenGroupAsync();
    if (!this.canAcceptNewScreenshotRequestForId(requestSessionId)) {
      return;
    }
    await this.startOpenGroup({
      sessionId: requestSessionId,
      targetTabId,
      pageUrl,
      issue: input,
      issueKey,
    });
  }

  async removeIssueEvidence(evidenceId: string): Promise<boolean> {
    const removed = await this.store.removeIssueEvidence(evidenceId);
    if (removed) {
      this.deps.onEvidenceChanged();
    }
    return removed;
  }

  getCaptureInFlightForTests(): boolean {
    return this.captureInFlight;
  }

  getPendingJobCountForTests(): number {
    return this.pendingJobs.length + (this.openGroup !== null ? 1 : 0);
  }

  private cancelSessionWork(sessionId: string | null): void {
    if (sessionId === null) {
      return;
    }
    if (this.openGroup?.sessionId === sessionId) {
      this.clearOpenGroupTimer();
      this.openGroup = null;
    }
    for (let index = this.pendingJobs.length - 1; index >= 0; index -= 1) {
      if (this.pendingJobs[index]?.sessionId === sessionId) {
        this.pendingJobs.splice(index, 1);
      }
    }
    for (const key of [...this.queuedIssueKeys]) {
      if (key.startsWith(`${sessionId}:`)) {
        this.queuedIssueKeys.delete(key);
      }
    }
  }

  private async startOpenGroup(input: {
    sessionId: string;
    targetTabId: number;
    pageUrl: string | null;
    issue: IssueRef;
    issueKey: string;
  }): Promise<void> {
    const frame = this.store.createQueuedFrame({
      sessionId: input.sessionId,
      pageUrl: input.pageUrl,
      createId: this.deps.createScreenshotId,
    });
    await this.store.upsertFrame(frame);
    await this.store.addLink({
      screenshotId: frame.id,
      issueCategory: input.issue.issueCategory,
      issueId: input.issue.issueId,
      sessionId: input.sessionId,
    });
    this.queuedIssueKeys.add(input.issueKey);

    this.openGroup = {
      sessionId: input.sessionId,
      targetTabId: input.targetTabId,
      pageUrl: input.pageUrl,
      frameId: frame.id,
      issues: [input.issue],
      timer: null,
    };
    this.deps.onEvidenceChanged();
    this.scheduleGroupFlush(this.openGroup);
  }

  private async attachIssueToGroup(
    group: OpenCaptureGroup,
    issue: IssueRef,
    issueKey: string,
  ): Promise<void> {
    group.issues.push(issue);
    await this.store.addLink({
      screenshotId: group.frameId,
      issueCategory: issue.issueCategory,
      issueId: issue.issueId,
      sessionId: group.sessionId,
    });
    this.queuedIssueKeys.add(issueKey);
    this.deps.onEvidenceChanged();
  }

  private scheduleGroupFlush(group: OpenCaptureGroup): void {
    this.clearOpenGroupTimer();
    group.timer = setTimeout(() => {
      void this.flushOpenGroupAsync();
    }, SCREENSHOT_GROUPING_WINDOW_MS);
  }

  private clearOpenGroupTimer(): void {
    if (this.openGroup?.timer !== null && this.openGroup?.timer !== undefined) {
      clearTimeout(this.openGroup.timer);
      this.openGroup.timer = null;
    }
  }

  private flushOpenGroupAsync(): Promise<void> {
    this.clearOpenGroupTimer();
    const group = this.openGroup;
    this.openGroup = null;
    if (group === null) {
      return Promise.resolve();
    }

    this.pendingJobs.push({
      sessionId: group.sessionId,
      targetTabId: group.targetTabId,
      pageUrl: group.pageUrl,
      frameId: group.frameId,
      issues: [...group.issues],
      rateLimitAttempt: 0,
    });
    void this.processQueueAsync();
    return Promise.resolve();
  }

  private async processQueueAsync(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;
    try {
      while (this.pendingJobs.length > 0) {
        const job = this.pendingJobs.shift();
        if (job === undefined) {
          break;
        }
        await this.waitForCaptureSlot();
        try {
          await this.runCaptureJob(job);
        } catch {
          await this.failCaptureJob(job, 'capture-failed');
        }
      }
    } finally {
      this.processing = false;
      this.captureInFlight = false;
    }
  }

  private async failCaptureJob(
    job: CaptureJob,
    reason: ScreenshotFailureReason,
  ): Promise<void> {
    try {
      const frame = this.store.findFrame(job.frameId);
      if (frame !== undefined) {
        await this.store.upsertFrame(this.store.finalizeFailed(frame, reason));
      }
      this.releaseIssueKeys(job);
      this.deps.onEvidenceChanged();
    } catch {
      this.releaseIssueKeys(job);
    }
  }

  private async waitForCaptureSlot(): Promise<void> {
    const elapsed = Date.now() - this.lastCaptureFinishedAt;
    const waitMs = SCREENSHOT_MIN_CAPTURE_INTERVAL_MS - elapsed;
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }

  private async runCaptureJob(job: CaptureJob): Promise<void> {
    if (!this.isJobSessionStillValid(job.sessionId)) {
      await this.dropJobEvidence(job);
      return;
    }

    const frame = this.store.findFrame(job.frameId);
    if (frame === undefined) {
      this.releaseIssueKeys(job);
      return;
    }

    const settings = this.deps.getSettings();
    if (
      this.store.countCapturedFramesForSession(job.sessionId) >=
      settings.maxPerSession
    ) {
      await this.store.upsertFrame(
        this.store.finalizeUnavailable(frame, 'session-screenshot-limit'),
      );
      this.releaseIssueKeys(job);
      this.deps.onEvidenceChanged();
      return;
    }

    const tabContext = await resolveMonitoredTabForCapture(job.targetTabId);
    if (!tabContext.ok) {
      await this.store.upsertFrame(
        this.store.finalizeUnavailable(frame, tabContext.reason),
      );
      this.releaseIssueKeys(job);
      this.deps.onEvidenceChanged();
      return;
    }

    if (!this.isJobSessionStillValid(job.sessionId)) {
      await this.dropJobEvidence(job);
      return;
    }

    await this.store.upsertFrame({ ...frame, status: 'pending' });
    this.deps.onEvidenceChanged();

    this.captureInFlight = true;
    let dataUrl: string;
    try {
      dataUrl = await browser.tabs.captureVisibleTab(tabContext.windowId, {
        format: 'jpeg',
        quality: 85,
      });
    } catch (error: unknown) {
      const reason = classifyCaptureVisibleTabError(error);
      if (
        isBrowserCaptureRateLimitReason(reason) &&
        job.rateLimitAttempt < RATE_LIMIT_MAX_RETRIES
      ) {
        const backoff = RATE_LIMIT_BACKOFF_MS[job.rateLimitAttempt] ?? 1_400;
        job.rateLimitAttempt += 1;
        await sleep(backoff);
        this.pendingJobs.unshift(job);
        await this.store.upsertFrame({ ...frame, status: 'queued' });
        this.deps.onEvidenceChanged();
        return;
      }
      await this.store.upsertFrame(this.store.finalizeFailed(frame, reason));
      this.releaseIssueKeys(job);
      this.deps.onEvidenceChanged();
      return;
    } finally {
      this.captureInFlight = false;
      this.lastCaptureFinishedAt = Date.now();
    }

    let blob: Blob;
    let width: number;
    let height: number;
    try {
      const processed = await processScreenshotDataUrl(dataUrl);
      blob = processed.blob;
      width = processed.width;
      height = processed.height;
    } catch {
      await this.store.upsertFrame(
        this.store.finalizeFailed(frame, 'image-processing-failed'),
      );
      this.releaseIssueKeys(job);
      this.deps.onEvidenceChanged();
      return;
    }

    if (!this.isJobSessionStillValid(job.sessionId)) {
      await this.dropJobEvidence(job);
      return;
    }

    try {
      await this.store.putBlob(frame.storageRef, blob);
    } catch {
      await this.store.upsertFrame(
        this.store.finalizeFailed(frame, 'storage-failed'),
      );
      this.releaseIssueKeys(job);
      this.deps.onEvidenceChanged();
      return;
    }

    const captured = {
      ...frame,
      status: 'captured' as const,
      capturedAt: Date.now(),
      width,
      height,
      pageUrl: tabContext.tab.url
        ? this.deps.sanitizePageUrl(tabContext.tab.url)
        : job.pageUrl,
    };
    try {
      await this.store.upsertFrame(captured);
    } catch {
      await this.store
        .upsertFrame(this.store.finalizeFailed(frame, 'storage-failed'))
        .catch(() => undefined);
      this.releaseIssueKeys(job);
      this.deps.onEvidenceChanged();
      return;
    }
    this.releaseIssueKeys(job);
    this.deps.onEvidenceChanged();
  }

  private canAcceptNewScreenshotRequest(
    session: SessionSnapshot,
  ): session is ActiveSessionSnapshot {
    return (
      isActiveSession(session) &&
      session.status === 'recording' &&
      session.id === this.activeSessionId
    );
  }

  private canAcceptNewScreenshotRequestForId(sessionId: string): boolean {
    const session = this.deps.getSessionState();
    if (!this.canAcceptNewScreenshotRequest(session)) {
      return false;
    }
    return session.id === sessionId;
  }

  private isJobSessionStillValid(sessionId: string): boolean {
    if (this.activeSessionId !== sessionId) {
      return false;
    }
    const session = this.deps.getSessionState();
    return isActiveSession(session) && session.id === sessionId;
  }

  private async dropJobEvidence(job: CaptureJob): Promise<void> {
    const frame = this.store.findFrame(job.frameId);
    if (frame !== undefined) {
      for (const issue of job.issues) {
        await this.store.unlinkIssue(issue.issueCategory, issue.issueId);
      }
    }
    this.releaseIssueKeys(job);
    this.deps.onEvidenceChanged();
  }

  private releaseIssueKeys(job: CaptureJob): void {
    for (const issue of job.issues) {
      this.queuedIssueKeys.delete(issueKeyFor(issue, job.sessionId));
    }
  }
}

function issueKeyFor(issue: IssueRef, sessionId?: string): string {
  if (sessionId !== undefined) {
    return `${sessionId}:${issue.issueCategory}:${issue.issueId}`;
  }
  return `${issue.issueCategory}:${issue.issueId}`;
}

function canJoinOpenGroup(
  group: OpenCaptureGroup,
  next: {
    sessionId: string;
    targetTabId: number;
    pageUrl: string | null;
  },
): boolean {
  return (
    group.sessionId === next.sessionId &&
    group.targetTabId === next.targetTabId &&
    group.pageUrl === next.pageUrl
  );
}

function isCategoryEnabled(
  settings: ScreenshotEvidenceSettings,
  category: ScreenshotIssueCategory,
): boolean {
  switch (category) {
    case 'ui':
      return settings.uiIssues;
    case 'console':
      return settings.consoleIssues;
    case 'network':
      return settings.networkIssues;
    case 'mark':
      return true;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
