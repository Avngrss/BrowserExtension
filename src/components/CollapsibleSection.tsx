import type { ReactNode } from 'react';

type CollapsibleSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  return (
    <details
      className="group rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="cursor-pointer list-none px-3 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
              {title}
            </h2>
            {description !== undefined ? (
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                {description}
              </p>
            ) : null}
          </div>
          <span
            aria-hidden="true"
            className="shrink-0 text-xs text-slate-500 group-open:rotate-180 dark:text-slate-400"
          >
            ▾
          </span>
        </div>
      </summary>
      <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-700">
        {children}
      </div>
    </details>
  );
}
