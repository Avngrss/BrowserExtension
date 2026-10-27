import type {
  IssueDisposition,
  IssueReviewCategory,
} from '@/src/domain/issue-disposition';

const DISPOSITION_OPTIONS: readonly {
  value: IssueDisposition;
  label: string;
}[] = [
  { value: 'unexpected', label: 'Unexpected' },
  { value: 'expected', label: 'Expected' },
  { value: 'excluded', label: 'Excluded' },
];

type IssueDispositionControlProps = {
  category: IssueReviewCategory;
  issueId: string;
  issueSummary: string;
  value: IssueDisposition;
  onChange: (disposition: IssueDisposition) => void;
  disabled?: boolean;
};

export function IssueDispositionControl({
  category,
  issueId,
  issueSummary,
  value,
  onChange,
  disabled = false,
}: IssueDispositionControlProps) {
  const groupLabel = `Review ${category} issue ${issueId}: ${issueSummary}`;

  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      className="mt-2 flex min-w-0 flex-wrap gap-1"
    >
      {DISPOSITION_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Mark ${category} issue as ${option.label}`}
            disabled={disabled}
            onClick={() => {
              if (!selected) {
                onChange(option.value);
              }
            }}
            className={[
              'rounded border px-2 py-0.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-slate-100',
              selected
                ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
              disabled ? 'cursor-not-allowed opacity-60' : '',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
