import { vi } from 'vitest';

export const extensionBrowserMock = {
  sidePanelSupported: true,
  getCurrentWindowId: vi.fn(() => Promise.resolve(7)),
  openSidePanel: vi.fn<(windowId: number) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  openOptionsPage: vi.fn(() => Promise.resolve()),
  activateTab: vi.fn<(tabId: number) => Promise<void>>(() => Promise.resolve()),
};

export function resetExtensionBrowserMock(): void {
  extensionBrowserMock.sidePanelSupported = true;
  extensionBrowserMock.getCurrentWindowId.mockReset();
  extensionBrowserMock.getCurrentWindowId.mockResolvedValue(7);
  extensionBrowserMock.openSidePanel.mockReset();
  extensionBrowserMock.openSidePanel.mockResolvedValue(undefined);
  extensionBrowserMock.openOptionsPage.mockReset();
  extensionBrowserMock.openOptionsPage.mockResolvedValue(undefined);
  extensionBrowserMock.activateTab.mockReset();
  extensionBrowserMock.activateTab.mockResolvedValue(undefined);
}
