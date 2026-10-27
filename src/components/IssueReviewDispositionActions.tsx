import type {
  IssueDisposition,
  IssueReviewCategory,
} from '@/src/domain/issue-disposition';

type IssueReviewDispositionActionsProps = {
  category: IssueReviewCategory;
  issueId: string;
  issueSummary: string;
  disposition: IssueDisposition;
  disabled?: boolean;
  onChange: (disposition: IssueDisposition) => void;
};

function inclusionLabel(disposition: IssueDisposition): string {
  if (disposition === 'excluded') {
    return 'Excluded';
  }
  if (disposition === 'expected') {
    return 'Expected';
  }
  return 'Included';
}

export function IssueReviewDispositionActions({
  category,
  issueId,
  issueSummary,
  disposition,
  disabled = false,
  onChange,
}: IssueReviewDispositionActionsProps) {
  const groupLabel = `Review ${category} issue ${issueId}: ${issueSummary}`;
  const included = disposition === 'unexpected';
  const excluded = disposition === 'excluded';
  const expected = disposition === 'expected';

  return (
    <div className="mt-2 flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {inclusionLabel(disposition)}
        </span>
        {expected ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            Expected
          </span>
        ) : null}
      </div>
      <div
        role="group"
        aria-label={groupLabel}
        className="flex min-w-0 flex-wrap gap-1"
      >
        <button
          type="button"
          disabled={disabled}
          aria-pressed={included}
          aria-label={`Include ${category} issue`}
          onClick={() => {
            if (!included) {
              onChange('unexpected');
            }
          }}
          className={[
            'rounded border px-2 py-0.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-slate-100',
            included
              ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950'
              : 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
            disabled ? 'cursor-not-allowed opacity-60' : '',
          ].join(' ')}
        >
          Include
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={excluded}
          aria-label={`Exclude ${category} issue`}
          onClick={() => {
            if (!excluded) {
              onChange('excluded');
            }
          }}
          className={[
            'rounded border px-2 py-0.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-slate-100',
            excluded
              ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950'
              : 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
            disabled ? 'cursor-not-allowed opacity-60' : '',
          ].join(' ')}
        >
          Exclude
        </button>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 marker:content-none dark:border-slate-600 dark:text-slate-200 [&::-webkit-details-marker]:hidden">
            More
          </summary>
          <div className="absolute z-10 mt-1 min-w-[10rem] rounded border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-600 dark:bg-slate-900">
            <button
              type="button"
              disabled={disabled}
              className="block w-full rounded px-2 py-1 text-left text-xs text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                onChange('expected');
              }}
            >
              Mark as expected
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
