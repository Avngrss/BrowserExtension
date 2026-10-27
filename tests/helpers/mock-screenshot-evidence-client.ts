import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';

let evidence: ScreenshotEvidence[] = [];

export const screenshotEvidenceClientMock = {
  getEvidence(): ScreenshotEvidence[] {
    return evidence;
  },
  setEvidence(next: ScreenshotEvidence[]): void {
    evidence = next;
  },
  reset(): void {
    evidence = [];
  },
};

export function resetScreenshotEvidenceClientMock(): void {
  screenshotEvidenceClientMock.reset();
}
