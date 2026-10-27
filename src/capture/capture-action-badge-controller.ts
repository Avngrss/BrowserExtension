import {
  resolveCaptureActionBadge,
  type IssueCountSnapshot,
} from '@/src/capture/capture-action-badge';
import type { SessionSnapshot } from '@/src/domain/session';

export type CaptureActionBadgeRuntime = {
  setBadge: (input: { text: string; title: string }) => Promise<void>;
};

export function createCaptureActionBadgeController(input: {
  runtime: CaptureActionBadgeRuntime;
}): {
  sync: (session: SessionSnapshot, issueCounts: IssueCountSnapshot) => void;
  clear: () => void;
} {
  return {
    sync(session, issueCounts) {
      const state = resolveCaptureActionBadge(session, issueCounts);
      void input.runtime
        .setBadge({ text: state.badgeText, title: state.title })
        .catch(() => undefined);
    },
    clear() {
      void input.runtime
        .setBadge({
          text: '',
          title: 'Bug Capture Assistant',
        })
        .catch(() => undefined);
    },
  };
}
