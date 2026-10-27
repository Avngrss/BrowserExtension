import type { SessionTargetBinding } from '@/src/domain/session-target';
import { isSupportedHttpUrl, sanitizeUrl } from '@/src/privacy/url-sanitizer';
import { browser } from 'wxt/browser';

export const NO_SUPPORTED_TARGET_TAB_MESSAGE =
  'Open an HTTP or HTTPS page tab and start monitoring from that tab.';

export type SessionTabResolution =
  { ok: true; binding: SessionTargetBinding } | { ok: false; message: string };

export type SessionTabResolver = {
  resolveActiveHttpTab(): Promise<SessionTabResolution>;
  resolveHttpTab(tabId: number): Promise<SessionTabResolution>;
};

type ResolvedTab = {
  id?: number;
  url?: string;
  title?: string;
  windowId?: number;
  active?: boolean;
};

function bindingFromTab(tab: ResolvedTab): SessionTargetBinding | null {
  if (tab.id === undefined || tab.url === undefined) {
    return null;
  }

  const sanitizedUrl = sanitizeUrl(tab.url);
  if (sanitizedUrl === null) {
    return null;
  }

  return {
    targetTabId: tab.id,
    targetUrl: sanitizedUrl,
    pageTitle: tab.title?.trim() || undefined,
  };
}

async function readTab(tabId: number): Promise<ResolvedTab | undefined> {
  try {
    return await browser.tabs.get(tabId);
  } catch {
    return undefined;
  }
}

export function createBrowserSessionTabResolver(): SessionTabResolver {
  return {
    async resolveHttpTab(tabId: number): Promise<SessionTabResolution> {
      let tab = await readTab(tabId);
      if (tab?.id !== undefined && tab.url === undefined) {
        tab = await readTab(tab.id);
      }
      const binding = tab ? bindingFromTab(tab) : null;
      if (binding === null) {
        return { ok: false, message: NO_SUPPORTED_TARGET_TAB_MESSAGE };
      }
      return { ok: true, binding };
    },
    async resolveActiveHttpTab(): Promise<SessionTabResolution> {
      const queried = await browser.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      let tab: ResolvedTab | undefined = queried[0];

      if (tab?.id !== undefined && tab.url === undefined) {
        tab = await readTab(tab.id);
      }

      let binding = tab ? bindingFromTab(tab) : null;
      if (binding !== null) {
        return { ok: true, binding };
      }

      if (tab?.windowId !== undefined) {
        const windowTabs = await browser.tabs.query({
          windowId: tab.windowId,
        });
        const httpTab =
          windowTabs.find(
            (candidate) =>
              candidate.active === true &&
              candidate.url !== undefined &&
              isSupportedHttpUrl(candidate.url),
          ) ??
          windowTabs.find(
            (candidate) =>
              candidate.url !== undefined && isSupportedHttpUrl(candidate.url),
          );

        if (httpTab !== undefined) {
          if (httpTab.id !== undefined && httpTab.url === undefined) {
            const resolved = await readTab(httpTab.id);
            binding = resolved ? bindingFromTab(resolved) : null;
          } else {
            binding = bindingFromTab(httpTab);
          }
        }
      }

      if (binding === null) {
        return { ok: false, message: NO_SUPPORTED_TARGET_TAB_MESSAGE };
      }

      return { ok: true, binding };
    },
  };
}
