type CompactStatPairProps = {
  actions: number;
  potentialIssues: number;
};

export function CompactStatPair({
  actions,
  potentialIssues,
}: CompactStatPairProps) {
  return (
    <div
      aria-label="Capture summary"
      className="grid min-w-0 grid-cols-2 gap-2"
    >
      <div className="min-w-0 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs text-slate-600 dark:text-slate-300">Actions</p>
        <p className="text-lg font-semibold text-slate-950 tabular-nums dark:text-slate-50">
          {actions}
        </p>
      </div>
      <div className="min-w-0 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Potential issues
        </p>
        <p className="text-lg font-semibold text-slate-950 tabular-nums dark:text-slate-50">
          {potentialIssues}
        </p>
      </div>
    </div>
  );
}
