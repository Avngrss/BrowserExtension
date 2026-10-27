import { useCallback, useEffect, useState } from 'react';
import type { SessionStatus } from '@/src/domain/session';

export type SidePanelView = 'capture' | 'summary' | 'review';

export function useSidePanelView(
  status: SessionStatus,
  loading: boolean,
): {
  view: SidePanelView;
  openReview: () => void;
  backToSummary: () => void;
} {
  const [view, setView] = useState<SidePanelView>('capture');

  useEffect(() => {
    if (loading) {
      return;
    }

    if (status === 'stopped') {
      setView((current) => (current === 'review' ? 'review' : 'summary'));
      return;
    }

    setView('capture');
  }, [loading, status]);

  const openReview = useCallback(() => {
    setView('review');
  }, []);

  const backToSummary = useCallback(() => {
    setView('summary');
  }, []);

  return { view, openReview, backToSummary };
}
