import type { TimelineEntry } from '@/src/domain/timeline-entry';
import type {
  IssueDisposition,
  IssueReviewCategory,
} from '@/src/domain/issue-disposition';
import { describeCapturedAction } from '@/src/actions/action-descriptions';
import { describeConsoleIssue } from '@/src/console/console-issue-descriptions';
import { describeNetworkIssue } from '@/src/network/network-issue-descriptions';
import { describeUiIssue } from '@/src/ui/ui-issue-descriptions';
import { formatActionTimelinePath } from '@/src/privacy/timeline-url';
import { IssueDispositionControl } from '@/src/components/IssueDispositionControl';

type CaptureTimelineProps = {
  entries: TimelineEntry[];
  onIssueDispositionChange?: (input: {
    category: IssueReviewCategory;
    issueId: string;
    disposition: IssueDisposition;
  }) => void;
  dispositionControlsDisabled?: boolean;
};

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function timelineDetailLine(entry: TimelineEntry): string {
  if (entry.kind === 'action') {
    const pathname = formatActionTimelinePath(entry.action.url);
    return `${describeCapturedAction(entry.action)} · ${pathname}`;
  }

  const pathname = formatActionTimelinePath(entry.issue.url);
  const description =
    entry.kind === 'console-issue'
      ? describeConsoleIssue(entry.issue)
      : entry.kind === 'ui-issue'
        ? describeUiIssue(entry.issue)
        : describeNetworkIssue(entry.issue);

  const parts = [description];
  if (entry.kind === 'console-issue' || entry.kind === 'ui-issue') {
    parts.push(pathname);
  }
  if (entry.issue.occurrenceCount > 1) {
    parts.push(`${entry.issue.occurrenceCount} occurrences`);
  }

  return parts.join(' · ');
}

function dispositionReviewCategory(
  entry: Exclude<TimelineEntry, { kind: 'action' }>,
): IssueReviewCategory {
  switch (entry.kind) {
    case 'console-issue':
      return 'console';
    case 'ui-issue':
      return 'ui';
    case 'network-issue':
      return 'network';
  }
}

function dispositionStatusLabel(disposition: IssueDisposition): string | null {
  if (disposition === 'expected') {
    return 'Expected';
  }
  if (disposition === 'excluded') {
    return 'Excluded';
  }
  return null;
}

export function CaptureTimeline({
  entries,
  onIssueDispositionChange,
  dispositionControlsDisabled = false,
}: CaptureTimelineProps) {
  return (
    <ol className="flex min-w-0 flex-col gap-2">
      {entries.map((entry) => {
        const isIssue = entry.kind !== 'action';
        const disposition = isIssue ? entry.issue.disposition : undefined;
        const reducedEmphasis =
          disposition === 'expected' || disposition === 'excluded';
        const statusLabel =
          disposition !== undefined
            ? dispositionStatusLabel(disposition)
            : null;

        return (
          <li
            key={
              entry.kind === 'action'
                ? entry.action.id
                : `${entry.kind}-${entry.issue.id}`
            }
            className={[
              'rounded-md border p-3',
              reducedEmphasis
                ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50'
                : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-950',
            ].join(' ')}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <time
                className="text-xs text-slate-600 dark:text-slate-300"
                dateTime={new Date(entry.timestamp).toISOString()}
              >
                {formatTimestamp(entry.timestamp)}
              </time>
              {statusLabel !== null ? (
                <span
                  className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-700 uppercase dark:bg-slate-700 dark:text-slate-100"
                  aria-label={`Issue classification: ${statusLabel}`}
                >
                  {statusLabel}
                </span>
              ) : null}
            </div>
            <p
              className={[
                'mt-1 text-sm font-medium',
                reducedEmphasis
                  ? 'text-slate-600 dark:text-slate-300'
                  : 'text-slate-950 dark:text-slate-50',
              ].join(' ')}
            >
              {timelineDetailLine(entry)}
            </p>
            {isIssue && onIssueDispositionChange !== undefined ? (
              <IssueDispositionControl
                category={dispositionReviewCategory(entry)}
                issueId={entry.issue.id}
                issueSummary={timelineDetailLine(entry)}
                value={entry.issue.disposition}
                disabled={dispositionControlsDisabled}
                onChange={(nextDisposition) => {
                  onIssueDispositionChange({
                    category: dispositionReviewCategory(entry),
                    issueId: entry.issue.id,
                    disposition: nextDisposition,
                  });
                }}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
