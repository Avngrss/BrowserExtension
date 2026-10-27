import { ISSUE_MARK_SCREENSHOT_ISSUE_ID } from '@/src/domain/issue-mark';
import type { ScreenshotIssueCategory } from '@/src/domain/screenshot-evidence';
import type { ScreenshotCaptureQueue } from '@/src/screenshots/screenshot-capture-queue';

export class ScreenshotCaptureService {
  constructor(private readonly queue: ScreenshotCaptureQueue) {}

  onNewSession(sessionId: string): void {
    this.queue.onNewSession(sessionId);
  }

  discardSession(sessionId: string): void {
    this.queue.discardSession(sessionId);
  }

  onRecordingStopped(): void {
    this.queue.onRecordingStopped();
  }

  async onNewUniqueIssue(input: {
    issueCategory: ScreenshotIssueCategory;
    issueId: string;
  }): Promise<void> {
    await this.queue.requestCaptureForIssue(input);
  }

  async removeScreenshot(evidenceId: string): Promise<boolean> {
    return this.queue.removeIssueEvidence(evidenceId);
  }

  async requestCaptureForBug(bugId: string): Promise<void> {
    await this.queue.requestCaptureForSessionMark(bugId);
  }

  async requestCaptureForMark(): Promise<void> {
    await this.queue.requestCaptureForSessionMark(
      ISSUE_MARK_SCREENSHOT_ISSUE_ID,
    );
  }
}
