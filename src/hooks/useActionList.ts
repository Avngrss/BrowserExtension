import type { CapturedAction } from '@/src/domain/action';
import { useSessionScopedItems } from '@/src/hooks/useSessionScopedItems';
import {
  ACTION_SYNC_FAILED_MESSAGE,
  actionClient,
} from '@/src/utils/action-client';

type UseActionListResult = {
  actions: CapturedAction[];
  loading: boolean;
  error: string | undefined;
};

export function useActionList(): UseActionListResult {
  const { items, loading, error } = useSessionScopedItems<CapturedAction>({
    syncFailedMessage: ACTION_SYNC_FAILED_MESSAGE,
    load: async () => {
      const response = await actionClient.getActions();
      if (!response.ok) {
        return { ok: false as const };
      }
      return { ok: true as const, items: response.actions };
    },
    subscribe: (handler) =>
      actionClient.subscribe((actions) => {
        handler(actions);
      }),
  });

  return { actions: items, loading, error };
}
