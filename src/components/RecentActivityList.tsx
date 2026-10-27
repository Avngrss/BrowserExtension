import type { TimelineEntry } from '@/src/domain/timeline-entry';
import {
  formatTimelineClock,
  timelineCategoryBadge,
  timelineReadableDescription,
} from '@/src/sidepanel/timeline-display';

type RecentActivityListProps = {
  entries: TimelineEntry[];
  limit?: number;
};

export function RecentActivityList({
  entries,
  limit = 5,
}: RecentActivityListProps) {
  const recent = entries.slice(-limit).reverse();

  if (recent.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        No activity yet. Explore the page to capture actions and issues.
      </p>
    );
  }

  return (
    <ol className="flex min-w-0 flex-col gap-2">
      {recent.map((entry) => {
        const badge = timelineCategoryBadge(entry);
        const key =
          entry.kind === 'action'
            ? entry.action.id
            : `${entry.kind}-${entry.issue.id}`;

        return (
          <li
            key={key}
            className="min-w-0 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <time
                className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400"
                dateTime={new Date(entry.timestamp).toISOString()}
              >
                {formatTimelineClock(entry.timestamp)}
              </time>
              {badge !== undefined && badge !== 'Action' ? (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {badge}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-950 dark:text-slate-50">
              {timelineReadableDescription(entry)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
