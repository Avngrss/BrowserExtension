import { Button } from '@/src/components/Button';
import type { IssueReviewCategory } from '@/src/domain/issue-disposition';

type IssueReviewBulkActionsProps = {
  disabled?: boolean;
  onMarkCategoryExpected: (category: IssueReviewCategory) => void;
  onMarkAllExpected: () => void;
};

export function IssueReviewBulkActions({
  disabled = false,
  onMarkCategoryExpected,
  onMarkAllExpected,
}: IssueReviewBulkActionsProps) {
  return (
    <div
      aria-label="Bulk issue review actions"
      className="flex min-w-0 flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900/60"
    >
      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
        Mark as expected
      </p>
      <div className="flex min-w-0 flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => onMarkCategoryExpected('ui')}
        >
          All UI
        </Button>
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => onMarkCategoryExpected('console')}
        >
          All Console
        </Button>
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => onMarkCategoryExpected('network')}
        >
          All Network
        </Button>
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={onMarkAllExpected}
        >
          All issues
        </Button>
      </div>
    </div>
  );
}
