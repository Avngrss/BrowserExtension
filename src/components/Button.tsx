import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
  disabled?: boolean;
  onClick?: () => void;
  'aria-describedby'?: string;
  'aria-label'?: string;
  fullWidth?: boolean;
};

const BASE_CLASS =
  'inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700 disabled:hover:bg-slate-200 dark:disabled:border-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-200 dark:disabled:hover:bg-slate-800';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'border-teal-800 bg-teal-800 text-white hover:border-teal-900 hover:bg-teal-900 focus-visible:outline-teal-800 dark:border-teal-300 dark:bg-teal-300 dark:text-slate-950 dark:hover:border-teal-200 dark:hover:bg-teal-200 dark:focus-visible:outline-teal-300',
  secondary:
    'border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus-visible:outline-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-100',
  danger:
    'border-red-800 bg-red-800 text-white hover:border-red-900 hover:bg-red-900 focus-visible:outline-red-800 dark:border-red-400 dark:bg-red-900 dark:text-red-50 dark:hover:border-red-300 dark:hover:bg-red-800 dark:focus-visible:outline-red-400',
};

export function Button({
  children,
  variant = 'primary',
  type = 'button',
  disabled = false,
  onClick,
  'aria-describedby': describedBy,
  'aria-label': ariaLabel,
  fullWidth = true,
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={`${BASE_CLASS} ${fullWidth ? 'w-full' : 'w-auto shrink-0'} ${VARIANT_CLASS[variant]}`}
      disabled={disabled}
      onClick={onClick}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
