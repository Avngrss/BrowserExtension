import { Button } from '@/src/components/Button';

type SessionConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  processing?: boolean;
};

export function SessionConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  processing = false,
}: SessionConfirmDialogProps) {
  return (
    <div
      role="dialog"
      aria-labelledby="session-confirm-title"
      className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"
    >
      <p
        id="session-confirm-title"
        className="text-sm font-semibold text-slate-950 dark:text-slate-50"
      >
        {title}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
        {message}
      </p>
      <div className="mt-3 flex min-w-0 flex-col gap-2">
        <Button
          variant={confirmVariant}
          disabled={processing}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button variant="secondary" disabled={processing} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
