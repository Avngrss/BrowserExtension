import type {
  ActiveSessionSnapshot,
  SessionSnapshot,
} from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';
import { formatActionTimelinePath } from '@/src/privacy/timeline-url';

export function getMonitoredHostname(snapshot: ActiveSessionSnapshot): string {
  try {
    return new URL(snapshot.targetUrl).hostname;
  } catch {
    return snapshot.targetUrl;
  }
}

export function getMonitoredPathname(snapshot: ActiveSessionSnapshot): string {
  return formatActionTimelinePath(snapshot.targetUrl);
}

export function formatMonitoredPagePath(
  snapshot: ActiveSessionSnapshot,
): string {
  return `Page: ${getMonitoredPathname(snapshot)}`;
}

export function getMonitoredPageTitle(
  snapshot: ActiveSessionSnapshot,
): string | undefined {
  const title = snapshot.pageTitle?.trim();
  if (title === undefined || title.length === 0) {
    return undefined;
  }
  return title;
}

/** @deprecated Use getMonitoredHostname for primary capture label. */
export function getMonitoredPageLabel(snapshot: ActiveSessionSnapshot): string {
  const title = getMonitoredPageTitle(snapshot);
  if (title !== undefined) {
    return title;
  }
  return getMonitoredHostname(snapshot);
}

export function getSessionDurationMs(
  snapshot: SessionSnapshot,
  now: number,
): number | null {
  if (!isActiveSession(snapshot)) {
    return null;
  }

  const end =
    snapshot.status === 'stopped'
      ? snapshot.stoppedAt
      : snapshot.status === 'paused'
        ? (snapshot.pausedAt ?? now)
        : now;

  return Math.max(0, end - snapshot.startedAt);
}

export function formatSessionDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function countPotentialIssues(input: {
  ui: number;
  console: number;
  network: number;
}): number {
  return input.ui + input.console + input.network;
}
