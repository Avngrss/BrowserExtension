import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import {
  DELETE_SCREENSHOT_EVIDENCE,
  GET_SCREENSHOT_EVIDENCE_LIST,
} from '@/src/messaging/screenshot-evidence-messages';
import { browser } from 'wxt/browser';

export async function fetchScreenshotEvidenceList(): Promise<
  ScreenshotEvidence[]
> {
  const response: unknown = await browser.runtime.sendMessage({
    type: GET_SCREENSHOT_EVIDENCE_LIST,
  });
  if (
    typeof response === 'object' &&
    response !== null &&
    'ok' in response &&
    response.ok === true &&
    'evidence' in response &&
    Array.isArray((response as { evidence: unknown }).evidence)
  ) {
    return (response as { evidence: ScreenshotEvidence[] }).evidence;
  }
  return [];
}

export async function deleteScreenshotEvidence(
  screenshotId: string,
): Promise<boolean> {
  const response: unknown = await browser.runtime.sendMessage({
    type: DELETE_SCREENSHOT_EVIDENCE,
    screenshotId,
  });
  return (
    typeof response === 'object' &&
    response !== null &&
    'ok' in response &&
    response.ok === true &&
    'deleted' in response &&
    (response as { deleted: boolean }).deleted === true
  );
}
