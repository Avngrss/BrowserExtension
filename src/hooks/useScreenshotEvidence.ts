import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import {
  scopedSessionItems,
  useSessionDataScope,
} from '@/src/hooks/session-data-scope';
import { isScreenshotEvidenceUpdatedMessage } from '@/src/messaging/screenshot-evidence-messages';
import {
  deleteScreenshotEvidence,
  fetchScreenshotEvidenceList,
} from '@/src/utils/screenshot-evidence-client';
import { browser } from 'wxt/browser';

function countUniqueFrames(
  evidence: ScreenshotEvidence[],
  status: ScreenshotEvidence['status'] | ScreenshotEvidence['status'][],
): number {
  const statuses = Array.isArray(status) ? status : [status];
  const frameIds = new Set<string>();
  for (const item of evidence) {
    if (statuses.includes(item.status)) {
      frameIds.add(item.frameId);
    }
  }
  return frameIds.size;
}

export function useScreenshotEvidence(): {
  evidence: ScreenshotEvidence[];
  loading: boolean;
  refresh: () => Promise<void>;
  removeScreenshot: (screenshotId: string) => Promise<boolean>;
  capturedFrameCount: number;
  pendingFrameCount: number;
  finalizingScreenshots: boolean;
} {
  const { scope, scopeRef } = useSessionDataScope();
  const [evidence, setEvidence] = useState<ScreenshotEvidence[]>([]);
  const [loading, setLoading] = useState(true);

  const applyEvidence = useCallback(
    (incoming: ScreenshotEvidence[]) => {
      setEvidence(scopedSessionItems(incoming, scopeRef.current));
    },
    [scopeRef],
  );

  useEffect(() => {
    if (scope === null) {
      setEvidence([]);
      setLoading(false);
    }
  }, [scope]);

  const refresh = useCallback(async () => {
    const loadScope = scopeRef.current;
    setLoading(true);
    try {
      const list = await fetchScreenshotEvidenceList();
      if (scopeRef.current !== loadScope) {
        return;
      }
      applyEvidence(list);
    } finally {
      if (scopeRef.current === loadScope) {
        setLoading(false);
      }
    }
  }, [applyEvidence, scopeRef]);

  useEffect(() => {
    let active = true;
    const loadScope = scopeRef.current;

    void (async () => {
      setLoading(true);
      try {
        const list = await fetchScreenshotEvidenceList();
        if (!active || scopeRef.current !== loadScope) {
          return;
        }
        applyEvidence(list);
      } finally {
        if (active && scopeRef.current === loadScope) {
          setLoading(false);
        }
      }
    })();

    const listener = (message: unknown): void => {
      if (!active || !isScreenshotEvidenceUpdatedMessage(message)) {
        return;
      }
      applyEvidence(message.evidence);
    };
    browser.runtime.onMessage.addListener(listener);
    return () => {
      active = false;
      browser.runtime.onMessage.removeListener(listener);
    };
  }, [applyEvidence, scope, scopeRef]);

  const removeScreenshot = useCallback(
    async (screenshotId: string) => {
      const deleted = await deleteScreenshotEvidence(screenshotId);
      if (deleted) {
        await refresh();
      }
      return deleted;
    },
    [refresh],
  );

  const capturedFrameCount = useMemo(
    () => countUniqueFrames(evidence, 'captured'),
    [evidence],
  );
  const pendingFrameCount = useMemo(
    () => countUniqueFrames(evidence, ['queued', 'pending']),
    [evidence],
  );
  const finalizingScreenshots = pendingFrameCount > 0;

  return {
    evidence,
    loading,
    refresh,
    removeScreenshot,
    capturedFrameCount,
    pendingFrameCount,
    finalizingScreenshots,
  };
}
