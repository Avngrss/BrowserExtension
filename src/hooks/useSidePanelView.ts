import { useCallback, useEffect, useState } from 'react';
import type { SessionStatus } from '@/src/domain/session';

export type SidePanelView = 'capture' | 'summary' | 'review' | 'prompt';

export function useSidePanelView(
  status: SessionStatus,
  loading: boolean,
): {
  view: SidePanelView;
  promptBugId: string | null;
  openReview: () => void;
  openPrompt: (bugId: string) => void;
  backToSummary: () => void;
} {
  const [view, setView] = useState<SidePanelView>('capture');
  const [promptBugId, setPromptBugId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (status === 'stopped') {
      setView((current) =>
        current === 'review' || current === 'prompt' ? current : 'summary',
      );
      return;
    }

    setView('capture');
  }, [loading, status]);

  const openReview = useCallback(() => {
    setView('review');
  }, []);

  const openPrompt = useCallback((bugId: string) => {
    setPromptBugId(bugId);
    setView('prompt');
  }, []);

  const backToSummary = useCallback(() => {
    setView('summary');
  }, []);

  return { view, promptBugId, openReview, openPrompt, backToSummary };
}
