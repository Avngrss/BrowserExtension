import type { ReactNode } from 'react';

type SectionCardProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function SectionCard({
  title,
  description,
  children,
}: SectionCardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {description}
      </p>
      {children !== undefined ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
