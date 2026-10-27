type StatusBadgeProps = {
  label: string;
};

export function StatusBadge({ label }: StatusBadgeProps) {
  return (
    <p
      role="status"
      className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full bg-slate-500 dark:bg-slate-300"
      />
      {label}
    </p>
  );
}
