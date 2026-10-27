import { describe, expect, it, vi } from 'vitest';
import {
  POTENTIAL_BUG_NOTIFICATION_TITLE,
  createIssueNotificationService,
} from '@/src/notifications/issue-notification-service';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';

function createService() {
  const createNotification = vi.fn(() => Promise.resolve());
  let nextId = 0;
  const service = createIssueNotificationService({
    getNotificationSettings: () => ({
      enabled: true,
      uiIssues: true,
      consoleIssues: false,
      networkIssues: true,
    }),
    getSessionState: () => ({
      status: 'recording',
      id: 's1',
      startedAt: 1,
      pausedAt: null,
      stoppedAt: null,
      ...DEFAULT_TEST_SESSION_TARGET,
    }),
    resolveNotificationTarget: () =>
      Promise.resolve({ tabId: 42, windowId: 7 }),
    runtime: {
      createNotification,
      onNotificationClicked: () => () => undefined,
      focusTarget: vi.fn(() => Promise.resolve()),
      openSidePanel: vi.fn(() => Promise.resolve()),
      getNotificationIconUrl: () => 'icon.png',
      createNotificationId: () => {
        nextId += 1;
        return `notification-${nextId}`;
      },
    },
  });
  return { service, createNotification };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('potential bug notifications', () => {
  it('creates one notification per potential bug with its description', async () => {
    const { service, createNotification } = createService();

    service.notifyPotentialBugCreated({
      issueCategory: 'ui',
      description: 'The page displayed “Payment unavailable”.',
    });
    service.notifyPotentialBugCreated({
      issueCategory: 'network',
      description: 'POST /api/pay returned HTTP 500.',
    });
    await flush();

    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        title: POTENTIAL_BUG_NOTIFICATION_TITLE,
        message: 'The page displayed “Payment unavailable”.',
      }),
    );
    service.dispose();
  });

  it('respects per-category notification settings', async () => {
    const { service, createNotification } = createService();
    service.notifyPotentialBugCreated({
      issueCategory: 'console',
      description: 'A JavaScript error was recorded: “Boom”.',
    });
    await flush();
    expect(createNotification).not.toHaveBeenCalled();
    service.dispose();
  });
});
