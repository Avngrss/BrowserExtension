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
  onGeneratePrompt: () => void;
  onSetStatus: (status: PotentialBugStatus) => void;
};

export function PotentialBugCard({
  bug,
  index,
  description,
  onGeneratePrompt,
  onSetStatus,
}: PotentialBugCardProps) {
  const excluded = bug.status === 'excluded';
  const hintId = `create-ticket-hint-${bug.id}`;

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
      <div className="flex min-w-0 flex-col gap-2">
        <Button
          type="button"
          disabled={excluded}
          aria-describedby={excluded ? hintId : undefined}
          onClick={onGeneratePrompt}
        >
          Create ticket
        </Button>
        {excluded ? (
          <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
            Include this bug to create a ticket.
          </p>
        ) : null}
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
    </article>
  );
}
