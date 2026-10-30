import { Button } from '@/src/components/Button';
import type {
  PotentialBug,
  PotentialBugStatus,
} from '@/src/domain/potential-bug';
import { potentialBugTitle } from '@/src/potential-bugs/potential-bug-description';

type PotentialBugCardProps = {
  bug: PotentialBug;
  index: number;
  description: string;
  screenshotCount: number;
  onGeneratePrompt: () => void;
  onReview: () => void;
  onSetStatus: (status: PotentialBugStatus) => void;
};

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function PotentialBugCard({
  bug,
  index,
  description,
  screenshotCount,
  onGeneratePrompt,
  onReview,
  onSetStatus,
}: PotentialBugCardProps) {
  const excluded = bug.status === 'excluded';
  const hintId = `generate-prompt-hint-${bug.id}`;

  return (
    <article
      aria-label={`Potential bug ${index + 1}`}
      className={`flex min-w-0 flex-col gap-2 rounded-lg border p-3 shadow-sm ${
        excluded
          ? 'border-dashed border-slate-300 bg-slate-50 opacity-75 dark:border-slate-600 dark:bg-slate-900/60'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
          {potentialBugTitle(bug, index)}
        </h3>
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
          {excluded ? 'Excluded' : bug.page.pathname}
        </span>
      </div>
      <p
        aria-label="Factual description"
        className="text-xs whitespace-pre-wrap text-slate-700 dark:text-slate-200"
      >
        {description}
      </p>
      <ul className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 tabular-nums dark:text-slate-300">
        <li>{countLabel(bug.actions.length, 'relevant Action')}</li>
        <li>{countLabel(bug.issues.length, 'related issue')}</li>
        <li>{countLabel(screenshotCount, 'screenshot')}</li>
      </ul>
      <div className="flex min-w-0 flex-col gap-2">
        <Button
          type="button"
          disabled={excluded}
          aria-describedby={excluded ? hintId : undefined}
          onClick={onGeneratePrompt}
        >
          Generate prompt
        </Button>
        {excluded ? (
          <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
            Include this bug to generate a prompt.
          </p>
        ) : null}
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={onReview}>
            Review
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              onSetStatus(excluded ? 'included' : 'excluded');
            }}
          >
            {excluded ? 'Include' : 'Exclude'}
          </Button>
        </div>
      </div>
    </article>
  );
}
