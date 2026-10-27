import { useMemo, useState } from 'react';
import { Button } from '@/src/components/Button';
import { IssueReviewDispositionActions } from '@/src/components/IssueReviewDispositionActions';
import type {
  IssueDisposition,
  IssueReviewCategory,
} from '@/src/domain/issue-disposition';
import {
  bulkCategoryForFilter,
  filterReviewIssues,
  mergeReviewIssues,
  type ReviewIssueFilter,
  type ReviewIssueRow,
} from '@/src/sidepanel/review-issues';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type { UiIssue } from '@/src/domain/ui-issue';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import { IssueReviewScreenshotEvidence } from '@/src/components/IssueReviewScreenshotEvidence';
import { SessionConfirmDialog } from '@/src/components/SessionConfirmDialog';

const FILTER_OPTIONS: readonly { id: ReviewIssueFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ui', label: 'UI' },
  { id: 'console', label: 'Console' },
  { id: 'network', label: 'Network' },
];

type IssueReviewScreenProps = {
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
  loading: boolean;
  error: string | undefined;
  onBack: () => void;
  onDispositionChange: (input: {
    category: IssueReviewCategory;
    issueId: string;
    disposition: IssueDisposition;
  }) => void;
  onBulkDisposition: (input: {
    category: IssueReviewCategory | 'all';
    disposition: IssueDisposition;
  }) => void;
  screenshotEvidence: ScreenshotEvidence[];
  onRemoveScreenshot: (screenshotId: string) => Promise<boolean>;
  onDeleteSession?: () => void;
  deleteConfirm?: {
    onConfirm: () => void;
    onCancel: () => void;
  };
  processing?: boolean;
};

export function IssueReviewScreen({
  uiIssues,
  consoleIssues,
  networkIssues,
  loading,
  error,
  onBack,
  onDispositionChange,
  onBulkDisposition,
  screenshotEvidence,
  onRemoveScreenshot,
  onDeleteSession,
  deleteConfirm,
  processing = false,
}: IssueReviewScreenProps) {
  const [filter, setFilter] = useState<ReviewIssueFilter>('all');

  const allIssues = useMemo(
    () =>
      mergeReviewIssues({
        uiIssues,
        consoleIssues,
        networkIssues,
      }),
    [consoleIssues, networkIssues, uiIssues],
  );

  const visibleIssues = useMemo(
    () => filterReviewIssues(allIssues, filter),
    [allIssues, filter],
  );

  return (
    <section aria-label="Issue Review" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
          Issue Review
        </h2>
        <Button variant="secondary" type="button" onClick={onBack}>
          Back to summary
        </Button>
      </div>

      <div
        role="tablist"
        aria-label="Issue category"
        className="flex min-w-0 flex-wrap gap-1"
      >
        {FILTER_OPTIONS.map((option) => {
          const selected = filter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={[
                'rounded border px-2 py-0.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-slate-100',
                selected
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950'
                  : 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
              ].join(' ')}
              onClick={() => {
                setFilter(option.id);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
        Review screenshots before exporting or sending session data.
      </p>

      <details className="rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900/60">
        <summary className="cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-200">
          Bulk actions
        </summary>
        <div className="mt-2 flex min-w-0 flex-col gap-1">
          <button
            type="button"
            disabled={loading}
            className="rounded px-2 py-1 text-left text-xs text-slate-800 hover:bg-white dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => {
              onBulkDisposition({
                category: bulkCategoryForFilter(filter),
                disposition: 'unexpected',
              });
            }}
          >
            Include all
          </button>
          <button
            type="button"
            disabled={loading}
            className="rounded px-2 py-1 text-left text-xs text-slate-800 hover:bg-white dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => {
              onBulkDisposition({
                category: bulkCategoryForFilter(filter),
                disposition: 'excluded',
              });
            }}
          >
            Exclude all
          </button>
          <button
            type="button"
            disabled={loading}
            className="rounded px-2 py-1 text-left text-xs text-slate-800 hover:bg-white dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => {
              onBulkDisposition({
                category: bulkCategoryForFilter(filter),
                disposition: 'expected',
              });
            }}
          >
            Mark all as expected
          </button>
        </div>
      </details>

      {error !== undefined ? (
        <p role="alert" className="text-sm text-red-800 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Loading issues…
        </p>
      ) : null}

      {!loading && visibleIssues.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          No issues in this category.
        </p>
      ) : null}

      {!loading && visibleIssues.length > 0 ? (
        <IssueReviewList
          issues={visibleIssues}
          disabled={loading}
          onDispositionChange={onDispositionChange}
          screenshotEvidence={screenshotEvidence}
          onRemoveScreenshot={onRemoveScreenshot}
        />
      ) : null}

      {deleteConfirm !== undefined ? (
        <SessionConfirmDialog
          title="Delete this session?"
          message="This removes all actions, issues, dispositions, and screenshots from this session."
          confirmLabel="Delete session"
          cancelLabel="Keep current session"
          confirmVariant="danger"
          processing={processing}
          onConfirm={deleteConfirm.onConfirm}
          onCancel={deleteConfirm.onCancel}
        />
      ) : null}

      {onDeleteSession !== undefined && deleteConfirm === undefined ? (
        <Button variant="danger" type="button" onClick={onDeleteSession}>
          Delete session
        </Button>
      ) : null}
    </section>
  );
}

function IssueReviewList({
  issues,
  disabled,
  onDispositionChange,
  screenshotEvidence,
  onRemoveScreenshot,
}: {
  issues: ReviewIssueRow[];
  disabled: boolean;
  onDispositionChange: IssueReviewScreenProps['onDispositionChange'];
  screenshotEvidence: ScreenshotEvidence[];
  onRemoveScreenshot: (screenshotId: string) => Promise<boolean>;
}) {
  return (
    <ol className="flex min-w-0 flex-col gap-2">
      {issues.map((issue) => (
        <li
          key={`${issue.category}-${issue.id}`}
          className="min-w-0 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"
        >
          <p className="text-sm font-medium text-slate-950 dark:text-slate-50">
            {issue.description}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {issue.pathname}
            {issue.occurrenceCount > 1
              ? ` · ${issue.occurrenceCount} occurrences`
              : ''}
          </p>
          <IssueReviewDispositionActions
            category={issue.category}
            issueId={issue.id}
            issueSummary={issue.description}
            disposition={issue.disposition}
            disabled={disabled}
            onChange={(disposition) => {
              onDispositionChange({
                category: issue.category,
                issueId: issue.id,
                disposition,
              });
            }}
          />
          <IssueReviewScreenshotEvidence
            category={issue.category}
            issueId={issue.id}
            disposition={issue.disposition}
            evidence={screenshotEvidence}
            onRemove={onRemoveScreenshot}
          />
        </li>
      ))}
    </ol>
  );
}
