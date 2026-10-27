import { createCaptureActionBadgeController } from '@/src/capture/capture-action-badge-controller';
import { isActiveSession } from '@/src/domain/session';
import { createIssueNotificationService } from '@/src/notifications/issue-notification-service';
import type { ExtensionSettingsService } from '@/src/settings/extension-settings-service';
import { browser } from 'wxt/browser';

const NOTIFICATION_ICON_PATH = 'icon-128.png';

export function createBackgroundCaptureIndicators(input: {
  settingsService: ExtensionSettingsService;
  getSessionState: () => import('@/src/domain/session').SessionSnapshot;
  getIssueCounts: () => { ui: number; console: number; network: number };
}): {
  notifyPotentialBugCreated: (event: {
    issueCategory: import('@/src/domain/potential-bug').PotentialBugIssueCategory;
    description: string;
  }) => void;
  syncBadge: () => void;
  clearBadge: () => void;
} {
  const badgeController = createCaptureActionBadgeController({
    runtime: {
      setBadge: async ({ text, title }) => {
        if (browser.action === undefined) {
          return;
        }
        await browser.action.setBadgeText({ text });
        await browser.action.setTitle({ title });
        if (text.length > 0) {
          await browser.action.setBadgeBackgroundColor({ color: '#0F766E' });
        }
      },
    },
  });

  const notificationService = createIssueNotificationService({
    getNotificationSettings: () =>
      input.settingsService.getNotificationSettings(),
    getSessionState: input.getSessionState,
    resolveNotificationTarget: async () => {
      const session = input.getSessionState();
      if (!isActiveSession(session)) {
        return null;
      }
      try {
        const tab = await browser.tabs.get(session.targetTabId);
        if (tab.id === undefined || tab.windowId === undefined) {
          return null;
        }
        return { tabId: tab.id, windowId: tab.windowId };
      } catch {
        return null;
      }
    },
    runtime: {
      createNotification: async ({ id, title, message, iconUrl }) => {
        if (browser.notifications === undefined) {
          return;
        }
        await browser.notifications.create(id, {
          type: 'basic',
          title,
          message,
          iconUrl,
        });
      },
      onNotificationClicked: (handler) => {
        if (browser.notifications?.onClicked === undefined) {
          return () => undefined;
        }
        const listener = (notificationId: string) => {
          handler(notificationId);
        };
        browser.notifications.onClicked.addListener(listener);
        return () => {
          browser.notifications.onClicked.removeListener(listener);
        };
      },
      focusTarget: async (target) => {
        await browser.windows.update(target.windowId, { focused: true });
        await browser.tabs.update(target.tabId, { active: true });
      },
      openSidePanel: async (windowId) => {
        if (browser.sidePanel?.open === undefined) {
          return;
        }
        await browser.sidePanel.open({ windowId });
      },
      getNotificationIconUrl: () => {
        const getUrl = browser.runtime.getURL.bind(browser.runtime) as (
          path: string,
        ) => string;
        return getUrl(NOTIFICATION_ICON_PATH);
      },
      createNotificationId: () => crypto.randomUUID(),
    },
  });

  return {
    notifyPotentialBugCreated: notificationService.notifyPotentialBugCreated,
    syncBadge: () => {
      badgeController.sync(input.getSessionState(), input.getIssueCounts());
    },
    clearBadge: () => {
      badgeController.clear();
    },
  };
}
