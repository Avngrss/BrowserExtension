import type { NetworkIssue } from '@/src/domain/network-issue';
import { useSessionScopedItems } from '@/src/hooks/useSessionScopedItems';
import {
  NETWORK_ISSUE_SYNC_FAILED_MESSAGE,
  networkIssueClient,
} from '@/src/utils/network-issue-client';

type UseNetworkIssueListResult = {
  issues: NetworkIssue[];
  loading: boolean;
  error: string | undefined;
};

export function useNetworkIssueList(): UseNetworkIssueListResult {
  const { items, loading, error } = useSessionScopedItems<NetworkIssue>({
    syncFailedMessage: NETWORK_ISSUE_SYNC_FAILED_MESSAGE,
    load: async () => {
      const response = await networkIssueClient.getIssues();
      if (!response.ok) {
        return { ok: false as const };
      }
      return { ok: true as const, items: response.issues };
    },
    subscribe: (handler) =>
      networkIssueClient.subscribe((issues) => {
        handler(issues);
      }),
  });

  return { issues: items, loading, error };
}
