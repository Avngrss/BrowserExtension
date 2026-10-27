import type { CapturedAction } from '@/src/domain/action';
import { describeCapturedAction } from '@/src/actions/action-descriptions';
import { formatActionTimelinePath } from '@/src/privacy/timeline-url';

type ActionTimelineProps = {
  actions: CapturedAction[];
};

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function isRedactedAction(action: CapturedAction): boolean {
  return action.type === 'input' || action.type === 'change'
    ? action.redacted === true
    : false;
}

function timelineDetailLine(action: CapturedAction): string {
  const parts = [describeCapturedAction(action)];

  if (isRedactedAction(action)) {
    parts.push('Sensitive value hidden');
  }

  parts.push(formatActionTimelinePath(action.url));
  return parts.join(' · ');
}

export function ActionTimeline({ actions }: ActionTimelineProps) {
  return (
    <ol className="flex min-w-0 flex-col gap-2">
      {actions.map((action) => (
        <li
          key={action.id}
          className="rounded-md border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-950"
        >
          <time
            className="text-xs text-slate-600 dark:text-slate-300"
            dateTime={new Date(action.timestamp).toISOString()}
          >
            {formatTimestamp(action.timestamp)}
          </time>
          <p className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
            {timelineDetailLine(action)}
          </p>
        </li>
      ))}
    </ol>
  );
}
