import { useCallback, useEffect, useState } from 'react';
import type {
  PotentialBug,
  PotentialBugStatus,
} from '@/src/domain/potential-bug';
import type { PotentialBugResponse } from '@/src/messaging/potential-bug-types';
import {
  POTENTIAL_BUG_SYNC_FAILED_MESSAGE,
  potentialBugClient,
} from '@/src/utils/potential-bug-client';

export type UsePotentialBugsResult = {
  bugs: PotentialBug[];
  loading: boolean;
  error: string | undefined;
  captureBugNow: (input: { note?: string }) => Promise<PotentialBugResponse>;
  setStatus: (bugId: string, status: PotentialBugStatus) => Promise<void>;
};

export function usePotentialBugs(): UsePotentialBugsResult {
  const [bugs, setBugs] = useState<PotentialBug[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void potentialBugClient
      .getBugs()
      .then((next) => {
        setBugs(next);
        setLoading(false);
      })
      .catch(() => {
        setError(POTENTIAL_BUG_SYNC_FAILED_MESSAGE);
        setLoading(false);
      });
    return potentialBugClient.subscribe((next) => {
      setBugs(next);
      setLoading(false);
      setError(undefined);
    });
  }, []);

  const captureBugNow = useCallback(async (input: { note?: string }) => {
    const response = await potentialBugClient.captureBugNow(input);
    if (response.ok) {
      setBugs(response.bugs);
    }
    return response;
  }, []);

  const setStatus = useCallback(
    async (bugId: string, status: PotentialBugStatus) => {
      const response = await potentialBugClient.setStatus(bugId, status);
      if (response.ok) {
        setBugs(response.bugs);
      }
    },
    [],
  );

  return { bugs, loading, error, captureBugNow, setStatus };
}
