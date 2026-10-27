import { useCallback, useEffect, useRef, useState } from 'react';
import {
  scopedSessionItems,
  useSessionDataScope,
} from '@/src/hooks/session-data-scope';

type LoadResult<T> =
  { ok: true; items: T[] } | { ok: false; error?: { message: string } };

export function useSessionScopedItems<T extends { sessionId: string }>(input: {
  load: () => Promise<LoadResult<T>>;
  subscribe: (handler: (items: T[]) => void) => () => void;
  syncFailedMessage: string;
}): { items: T[]; loading: boolean; error: string | undefined } {
  const { scope, scopeRef } = useSessionDataScope();
  const loadRef = useRef(input.load);
  const subscribeRef = useRef(input.subscribe);
  loadRef.current = input.load;
  subscribeRef.current = input.subscribe;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const applyItems = useCallback(
    (incoming: T[]) => {
      setItems(scopedSessionItems(incoming, scopeRef.current));
      setError(undefined);
    },
    [scopeRef],
  );

  useEffect(() => {
    if (scope === null) {
      setItems([]);
      setError(undefined);
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    let active = true;
    const loadScope = scopeRef.current;

    void (async () => {
      const response = await loadRef.current();
      if (!active || scopeRef.current !== loadScope) {
        return;
      }

      if (!response.ok) {
        if (scopeRef.current === null) {
          setItems([]);
        }
        setError(input.syncFailedMessage);
        setLoading(false);
        return;
      }

      applyItems(response.items);
      setLoading(false);
    })();

    const unsubscribe = subscribeRef.current((incoming) => {
      if (active) {
        applyItems(incoming);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyItems, input.syncFailedMessage, scope, scopeRef]);

  return { items, loading, error };
}
