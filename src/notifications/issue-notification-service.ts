import type { PotentialBugIssueCategory } from '@/src/domain/potential-bug';
import { shouldNotifyForIssueCategory } from '@/src/notifications/issue-notification-settings';
import type { IssueNotificationSettings } from '@/src/settings/extension-settings';
import { isActiveSession } from '@/src/domain/session';

export const POTENTIAL_BUG_NOTIFICATION_TITLE = 'Potential bug captured';
const NOTIFICATION_MESSAGE_MAX_LENGTH = 160;

export type IssueNotificationTarget = {
  tabId: number;
  windowId: number;
};

export type IssueNotificationRuntime = {
  createNotification: (input: {
    id: string;
    title: string;
    message: string;
    iconUrl: string;
  }) => Promise<void>;
  onNotificationClicked: (
    handler: (notificationId: string) => void,
  ) => () => void;
  focusTarget: (target: IssueNotificationTarget) => Promise<void>;
  openSidePanel: (windowId: number) => Promise<void>;
  getNotificationIconUrl: () => string;
  createNotificationId: () => string;
};

function truncateMessage(message: string): string {
  if (message.length <= NOTIFICATION_MESSAGE_MAX_LENGTH) {
    return message;
  }
  return `${message.slice(0, NOTIFICATION_MESSAGE_MAX_LENGTH - 1)}…`;
}

export function createIssueNotificationService(input: {
  runtime: IssueNotificationRuntime;
  getNotificationSettings: () => IssueNotificationSettings;
  getSessionState: () => import('@/src/domain/session').SessionSnapshot;
  resolveNotificationTarget: () => Promise<IssueNotificationTarget | null>;
}): {
  notifyPotentialBugCreated: (event: {
    issueCategory: PotentialBugIssueCategory;
    description: string;
  }) => void;
  dispose: () => void;
} {
  const clickTargets = new Map<string, IssueNotificationTarget>();

  const unsubscribeClick = input.runtime.onNotificationClicked((id) => {
    const target = clickTargets.get(id);
    if (target === undefined) {
      return;
    }
    clickTargets.delete(id);
    void input.runtime
      .focusTarget(target)
      .then(() => input.runtime.openSidePanel(target.windowId))
      .catch(() => undefined);
  });

  function notifyPotentialBugCreated(event: {
    issueCategory: PotentialBugIssueCategory;
    description: string;
  }): void {
    const settings = input.getNotificationSettings();
    if (!shouldNotifyForIssueCategory(settings, event.issueCategory)) {
      return;
    }

    const session = input.getSessionState();
    if (!isActiveSession(session) || session.status !== 'recording') {
      return;
    }

    void input.resolveNotificationTarget().then((target) => {
      if (target === null) {
        return;
      }
      const id = input.runtime.createNotificationId();
      clickTargets.set(id, target);
      void input.runtime
        .createNotification({
          id,
          title: POTENTIAL_BUG_NOTIFICATION_TITLE,
          message: truncateMessage(event.description),
          iconUrl: input.runtime.getNotificationIconUrl(),
        })
        .catch(() => undefined);
    });
  }

  return {
    notifyPotentialBugCreated,
    dispose: () => {
      unsubscribeClick();
      clickTargets.clear();
    },
  };
}
