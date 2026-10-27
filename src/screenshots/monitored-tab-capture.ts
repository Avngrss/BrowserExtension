import type { ScreenshotFailureReason } from '@/src/domain/screenshot-evidence';
import { browser } from 'wxt/browser';

export type MonitoredTabCaptureContext =
  | {
      ok: true;
      tab: chrome.tabs.Tab;
      windowId: number;
    }
  | {
      ok: false;
      reason: ScreenshotFailureReason;
    };

export async function resolveMonitoredTabForCapture(
  targetTabId: number,
): Promise<MonitoredTabCaptureContext> {
  let tab: chrome.tabs.Tab;
  try {
    tab = await browser.tabs.get(targetTabId);
  } catch {
    return { ok: false, reason: 'target-tab-not-visible' };
  }

  if (tab.id !== targetTabId || tab.active !== true) {
    return { ok: false, reason: 'target-tab-not-visible' };
  }

  const windowId = tab.windowId;
  if (windowId === undefined) {
    return { ok: false, reason: 'target-tab-not-visible' };
  }

  const activeInWindow = await browser.tabs.query({
    active: true,
    windowId,
  });
  if (activeInWindow[0]?.id !== targetTabId) {
    return { ok: false, reason: 'target-tab-not-visible' };
  }

  return { ok: true, tab, windowId };
}
