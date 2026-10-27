import type { SessionStateUpdatedMessage } from '@/src/messaging/session-types';
import { ensureTargetTabContentBootstrap } from '@/src/sessions/content-tab-bootstrap';
import { browser } from 'wxt/browser';

export async function deliverSessionStateToTargetTab(
  tabId: number,
  message: SessionStateUpdatedMessage,
): Promise<
  | { ok: true }
  | {
      ok: false;
      code: 'CONTENT_BOOTSTRAP_FAILED' | 'UNSUPPORTED_TARGET_TAB';
      message: string;
    }
> {
  const bootstrap = await ensureTargetTabContentBootstrap(tabId);
  if (!bootstrap.ok) {
    return bootstrap;
  }

  try {
    await browser.tabs.sendMessage(tabId, message);
    return { ok: true };
  } catch {
    const retryBootstrap = await ensureTargetTabContentBootstrap(tabId);
    if (!retryBootstrap.ok) {
      return retryBootstrap;
    }
    try {
      await browser.tabs.sendMessage(tabId, message);
      return { ok: true };
    } catch {
      return {
        ok: false,
        code: 'CONTENT_BOOTSTRAP_FAILED',
        message: 'Capture could not start on this page.',
      };
    }
  }
}
