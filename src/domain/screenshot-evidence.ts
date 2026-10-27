export type ScreenshotIssueCategory = 'ui' | 'console' | 'network' | 'mark';

export type ScreenshotEvidenceStatus =
  'queued' | 'pending' | 'captured' | 'failed' | 'unavailable';

export type ScreenshotFailureReason =
  | 'target-tab-not-visible'
  | 'capture-permission-denied'
  | 'capture-rate-limited'
  | 'session-screenshot-limit'
  | 'image-processing-failed'
  | 'storage-failed'
  | 'capture-failed';

export type ScreenshotFrame = {
  id: string;
  sessionId: string;
  capturedAt: number;
  pageUrl: string | null;
  width: number;
  height: number;
  format: 'jpeg';
  storageRef: string;
  status: ScreenshotEvidenceStatus;
  failureReason?: ScreenshotFailureReason;
};

export type ScreenshotIssueLink = {
  screenshotId: string;
  issueCategory: ScreenshotIssueCategory;
  issueId: string;
  sessionId: string;
};

/** Per-issue view for UI and messaging (legacy-compatible shape). */
export type ScreenshotEvidence = {
  id: string;
  frameId: string;
  sessionId: string;
  issueCategory: ScreenshotIssueCategory;
  issueId: string;
  capturedAt: number;
  pageUrl: string | null;
  width: number;
  height: number;
  format: 'jpeg';
  storageRef: string;
  status: ScreenshotEvidenceStatus;
  failureReason?: ScreenshotFailureReason;
  linkedIssueCount: number;
};

export function screenshotIssueEvidenceId(
  link: Pick<ScreenshotIssueLink, 'screenshotId' | 'issueCategory' | 'issueId'>,
): string {
  return `${link.screenshotId}:${link.issueCategory}:${link.issueId}`;
}

export function parseScreenshotIssueEvidenceId(id: string): {
  screenshotId: string;
  issueCategory: ScreenshotIssueCategory;
  issueId: string;
} | null {
  const parts = id.split(':');
  if (parts.length < 3) {
    return null;
  }
  const issueId = parts.slice(2).join(':');
  const issueCategory = parts[1];
  if (
    issueCategory !== 'ui' &&
    issueCategory !== 'console' &&
    issueCategory !== 'network' &&
    issueCategory !== 'mark'
  ) {
    return null;
  }
  return { screenshotId: parts[0] ?? '', issueCategory, issueId };
}

export function isScreenshotFailureReason(
  value: string,
): value is ScreenshotFailureReason {
  return (
    value === 'target-tab-not-visible' ||
    value === 'capture-permission-denied' ||
    value === 'capture-rate-limited' ||
    value === 'session-screenshot-limit' ||
    value === 'image-processing-failed' ||
    value === 'storage-failed' ||
    value === 'capture-failed'
  );
}

export function screenshotStatusLabel(input: {
  status: ScreenshotEvidenceStatus;
  failureReason?: ScreenshotFailureReason;
}): string {
  switch (input.status) {
    case 'queued':
      return 'Screenshot queued';
    case 'pending':
      return 'Capturing screenshot…';
    case 'captured':
      return '';
    case 'unavailable':
    case 'failed':
      return screenshotUnavailableLabel(input.failureReason);
  }
}

export function screenshotUnavailableLabel(
  reason: ScreenshotFailureReason | undefined,
): string {
  switch (reason) {
    case 'target-tab-not-visible':
      return 'Screenshot unavailable: monitored tab was not visible';
    case 'capture-permission-denied':
      return 'Screenshot unavailable: capture permission denied';
    case 'capture-rate-limited':
      return 'Screenshot unavailable: browser capture limit';
    case 'session-screenshot-limit':
      return 'Screenshot unavailable: session screenshot limit reached';
    case 'image-processing-failed':
      return 'Screenshot unavailable: image processing failed';
    case 'storage-failed':
      return 'Screenshot unavailable: local storage failed';
    case 'capture-failed':
    default:
      return 'Screenshot unavailable: capture failed';
  }
}

export function buildIssueEvidenceView(
  frame: ScreenshotFrame,
  link: ScreenshotIssueLink,
  linkedIssueCount: number,
): ScreenshotEvidence {
  return {
    id: screenshotIssueEvidenceId(link),
    frameId: frame.id,
    sessionId: frame.sessionId,
    issueCategory: link.issueCategory,
    issueId: link.issueId,
    capturedAt: frame.capturedAt,
    pageUrl: frame.pageUrl,
    width: frame.width,
    height: frame.height,
    format: frame.format,
    storageRef: frame.storageRef,
    status: frame.status,
    failureReason: frame.failureReason,
    linkedIssueCount,
  };
}
