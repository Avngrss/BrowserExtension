import type { ScreenshotFailureReason } from '@/src/domain/screenshot-evidence';

export function classifyCaptureVisibleTabError(
  error: unknown,
): ScreenshotFailureReason {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    /rate|quota|max_capture|too many|throttl|calls per second|try again later/i.test(
      message,
    )
  ) {
    return 'capture-rate-limited';
  }

  if (
    /permission|denied|not allowed|cannot capture|<all_urls>|activetab|extension manifest/i.test(
      lower,
    )
  ) {
    return 'capture-permission-denied';
  }

  if (/image|decode|canvas|bitmap|processing/i.test(lower)) {
    return 'image-processing-failed';
  }

  return 'capture-failed';
}

export function isBrowserCaptureRateLimitReason(
  reason: ScreenshotFailureReason,
): boolean {
  return reason === 'capture-rate-limited';
}
