import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

export function useActiveTabInWindow(): number | null {
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function refresh(): Promise<void> {
      try {
        const tabs = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (active) {
          setActiveTabId(tabs[0]?.id ?? null);
        }
      } catch {
        if (active) {
          setActiveTabId(null);
        }
      }
    }

    void refresh();

    const onActivated = (): void => {
      void refresh();
    };
    const onUpdated = (
      _tabId: number,
      changeInfo: { status?: string },
    ): void => {
      if (changeInfo.status === 'complete') {
        void refresh();
      }
    };

    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);

    return () => {
      active = false;
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return activeTabId;
}
