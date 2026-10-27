import type { IssueDispositionBreakdown } from '@/src/issues/issue-disposition-stats';

type SummaryCardProps = {
  label: string;
  value: number;
  dispositionBreakdown?: IssueDispositionBreakdown;
};

function DispositionBreakdownLine({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <li className="text-xs text-slate-600 tabular-nums dark:text-slate-300">
      {label}: {count}
    </li>
  );
}

export function SummaryCard({
  label,
  value,
  dispositionBreakdown,
}: SummaryCardProps) {
  const showBreakdown =
    value > 0 &&
    dispositionBreakdown !== undefined &&
    (dispositionBreakdown.unexpected > 0 ||
      dispositionBreakdown.expected > 0 ||
      dispositionBreakdown.excluded > 0);

  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-xs font-medium tracking-wide text-slate-600 uppercase dark:text-slate-300">
        {label}
      </h3>
      <p className="mt-1 text-2xl font-semibold text-slate-950 tabular-nums dark:text-slate-50">
        {value}
      </p>
      {showBreakdown ? (
        <ul
          aria-label={`${label} issue disposition breakdown`}
          className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-0.5"
        >
          <DispositionBreakdownLine
            label="Unexpected"
            count={dispositionBreakdown.unexpected}
          />
          <DispositionBreakdownLine
            label="Expected"
            count={dispositionBreakdown.expected}
          />
          <DispositionBreakdownLine
            label="Excluded"
            count={dispositionBreakdown.excluded}
          />
        </ul>
      ) : null}
    </article>
  );
}
