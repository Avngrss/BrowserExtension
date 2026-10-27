import { useEffect, useRef, useState } from 'react';
import type { SessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';
import { sessionClient } from '@/src/utils/session-client';

export function getSessionDataScope(snapshot: SessionSnapshot): string | null {
  if (!isActiveSession(snapshot)) {
    return null;
  }
  return snapshot.id;
}

export function scopedSessionItems<T extends { sessionId: string }>(
  items: T[],
  scope: string | null,
): T[] {
  if (scope === null) {
    return [];
  }
  return items.filter((item) => item.sessionId === scope);
}

export function useSessionDataScope(): {
  scope: string | null;
  scopeRef: { current: string | null };
} {
  const scopeRef = useRef<string | null>(null);
  const [scope, setScope] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const applyScope = (snapshot: SessionSnapshot): void => {
      const next = getSessionDataScope(snapshot);
      scopeRef.current = next;
      setScope(next);
    };

    void sessionClient.getState().then((response) => {
      if (active && response.ok) {
        applyScope(response.state);
      }
    });

    const unsubscribe = sessionClient.subscribe((state) => {
      if (active) {
        applyScope(state);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { scope, scopeRef };
}
