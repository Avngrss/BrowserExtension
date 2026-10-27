import type { ConsoleIssue } from '@/src/domain/console-issue';
import { useSessionScopedItems } from '@/src/hooks/useSessionScopedItems';
import {
  CONSOLE_ISSUE_SYNC_FAILED_MESSAGE,
  consoleIssueClient,
} from '@/src/utils/console-issue-client';

type UseConsoleIssueListResult = {
  issues: ConsoleIssue[];
  loading: boolean;
  error: string | undefined;
};

export function useConsoleIssueList(): UseConsoleIssueListResult {
  const { items, loading, error } = useSessionScopedItems<ConsoleIssue>({
    syncFailedMessage: CONSOLE_ISSUE_SYNC_FAILED_MESSAGE,
    load: async () => {
      const response = await consoleIssueClient.getIssues();
      if (!response.ok) {
        return { ok: false as const };
      }
      return { ok: true as const, items: response.issues };
    },
    subscribe: (handler) =>
      consoleIssueClient.subscribe((issues) => {
        handler(issues);
      }),
  });

  return { issues: items, loading, error };
}
