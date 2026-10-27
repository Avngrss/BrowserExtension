import type { UiIssue } from '@/src/domain/ui-issue';
import { useSessionScopedItems } from '@/src/hooks/useSessionScopedItems';
import {
  UI_ISSUE_SYNC_FAILED_MESSAGE,
  uiIssueClient,
} from '@/src/utils/ui-issue-client';

type UseUiIssueListResult = {
  issues: UiIssue[];
  loading: boolean;
  error: string | undefined;
};

export function useUiIssueList(): UseUiIssueListResult {
  const { items, loading, error } = useSessionScopedItems<UiIssue>({
    syncFailedMessage: UI_ISSUE_SYNC_FAILED_MESSAGE,
    load: async () => {
      const response = await uiIssueClient.getIssues();
      if (!response.ok) {
        return { ok: false as const };
      }
      return { ok: true as const, items: response.issues };
    },
    subscribe: (handler) =>
      uiIssueClient.subscribe((issues) => {
        handler(issues);
      }),
  });

  return { issues: items, loading, error };
}
