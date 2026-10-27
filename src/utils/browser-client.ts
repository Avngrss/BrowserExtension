import { browser } from 'wxt/browser';
import {
  SETTINGS_UNSUPPORTED_MESSAGE,
  WINDOW_UNAVAILABLE_MESSAGE,
} from '@/src/utils/extension-pages';

export type ExtensionBrowser = {
  getCurrentWindowId: () => Promise<number>;
  openSidePanel: ((windowId: number) => Promise<void>) | undefined;
  openOptionsPage: () => Promise<void>;
  activateTab: (tabId: number) => Promise<void>;
};

function getBrowserNamespace(): typeof browser | undefined {
  if (typeof browser === 'undefined') {
    return undefined;
  }

  return browser;
}

function createOpenSidePanel():
  ((windowId: number) => Promise<void>) | undefined {
  const runtimeBrowser = getBrowserNamespace();
  const sidePanel = runtimeBrowser?.sidePanel;
  if (sidePanel === undefined) {
    return undefined;
  }

  return (windowId) => sidePanel.open({ windowId });
}

async function getCurrentWindowId(): Promise<number> {
  const runtimeBrowser = getBrowserNamespace();
  if (runtimeBrowser === undefined) {
    throw new Error(WINDOW_UNAVAILABLE_MESSAGE);
  }

  const currentWindow = await runtimeBrowser.windows.getCurrent();
  if (currentWindow.id === undefined) {
    throw new Error(WINDOW_UNAVAILABLE_MESSAGE);
  }

  return currentWindow.id;
}

async function activateTab(tabId: number): Promise<void> {
  const runtimeBrowser = getBrowserNamespace();
  if (runtimeBrowser === undefined) {
    throw new Error(WINDOW_UNAVAILABLE_MESSAGE);
  }

  const tab = await runtimeBrowser.tabs.get(tabId);
  if (tab.windowId !== undefined) {
    await runtimeBrowser.windows.update(tab.windowId, { focused: true });
  }
  await runtimeBrowser.tabs.update(tabId, { active: true });
}

function openOptionsPage(): Promise<void> {
  const runtimeBrowser = getBrowserNamespace();
  if (
    runtimeBrowser === undefined ||
    typeof runtimeBrowser.runtime.openOptionsPage !== 'function'
  ) {
    return Promise.reject(new Error(SETTINGS_UNSUPPORTED_MESSAGE));
  }

  return Promise.resolve(runtimeBrowser.runtime.openOptionsPage());
}

export const extensionBrowser: ExtensionBrowser = {
  getCurrentWindowId,
  openSidePanel: createOpenSidePanel(),
  openOptionsPage,
  activateTab,
};
