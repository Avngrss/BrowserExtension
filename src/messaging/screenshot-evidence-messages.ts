import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';

export const GET_SCREENSHOT_EVIDENCE_LIST = 'GET_SCREENSHOT_EVIDENCE_LIST';
export const DELETE_SCREENSHOT_EVIDENCE = 'DELETE_SCREENSHOT_EVIDENCE';
export const SCREENSHOT_EVIDENCE_UPDATED = 'SCREENSHOT_EVIDENCE_UPDATED';

export type GetScreenshotEvidenceListMessage = {
  type: typeof GET_SCREENSHOT_EVIDENCE_LIST;
};

export type DeleteScreenshotEvidenceMessage = {
  type: typeof DELETE_SCREENSHOT_EVIDENCE;
  screenshotId: string;
};

export type ScreenshotEvidenceUpdatedMessage = {
  type: typeof SCREENSHOT_EVIDENCE_UPDATED;
  evidence: ScreenshotEvidence[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isGetScreenshotEvidenceListMessage(
  message: unknown,
): message is GetScreenshotEvidenceListMessage {
  return isRecord(message) && message.type === GET_SCREENSHOT_EVIDENCE_LIST;
}

export function isDeleteScreenshotEvidenceMessage(
  message: unknown,
): message is DeleteScreenshotEvidenceMessage {
  return (
    isRecord(message) &&
    message.type === DELETE_SCREENSHOT_EVIDENCE &&
    typeof message.screenshotId === 'string'
  );
}

export function isScreenshotEvidenceUpdatedMessage(
  message: unknown,
): message is ScreenshotEvidenceUpdatedMessage {
  return (
    isRecord(message) &&
    message.type === SCREENSHOT_EVIDENCE_UPDATED &&
    Array.isArray(message.evidence)
  );
}

export function createScreenshotEvidenceUpdatedMessage(
  evidence: ScreenshotEvidence[],
): ScreenshotEvidenceUpdatedMessage {
  return {
    type: SCREENSHOT_EVIDENCE_UPDATED,
    evidence,
  };
}
