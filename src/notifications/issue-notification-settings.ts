import type { ScreenshotIssueCategory } from '@/src/domain/screenshot-evidence';
import type { IssueNotificationSettings } from '@/src/settings/extension-settings';

export function shouldNotifyForIssueCategory(
  settings: IssueNotificationSettings,
  category: ScreenshotIssueCategory,
): boolean {
  if (!settings.enabled) {
    return false;
  }
  switch (category) {
    case 'ui':
      return settings.uiIssues;
    case 'console':
      return settings.consoleIssues;
    case 'network':
      return settings.networkIssues;
    default:
      return false;
  }
}
