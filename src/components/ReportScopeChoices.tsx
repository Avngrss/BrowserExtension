import type {
  IssueMarkReportScope,
  IssueMarkReportScopeWithoutMark,
} from '@/src/domain/issue-mark';

type ReportScopeChoicesProps =
  | {
      mode: 'with-mark';
      value: IssueMarkReportScope;
      onChange: (scope: IssueMarkReportScope) => void;
      disabled?: boolean;
    }
  | {
      mode: 'without-mark';
      value: IssueMarkReportScopeWithoutMark;
      onChange: (scope: IssueMarkReportScopeWithoutMark) => void;
      disabled?: boolean;
    };

export function ReportScopeChoices(props: ReportScopeChoicesProps) {
  if (props.mode === 'with-mark') {
    return (
      <fieldset
        className="flex min-w-0 flex-col gap-2"
        disabled={props.disabled}
      >
        <legend className="text-xs font-semibold text-slate-950 dark:text-slate-50">
          Report scope
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="report-scope-mark"
            checked={props.value === 'around-mark'}
            onChange={() => {
              props.onChange('around-mark');
            }}
          />
          Around marked issue
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="report-scope-mark"
            checked={props.value === 'full-session'}
            onChange={() => {
              props.onChange('full-session');
            }}
          />
          Full session
        </label>
      </fieldset>
    );
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2" disabled={props.disabled}>
      <legend className="text-xs font-semibold text-slate-950 dark:text-slate-50">
        Report scope
      </legend>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="report-scope-no-mark"
          checked={props.value === 'last-10-actions'}
          onChange={() => {
            props.onChange('last-10-actions');
          }}
        />
        Last 10 actions
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="report-scope-no-mark"
          checked={props.value === 'full-session'}
          onChange={() => {
            props.onChange('full-session');
          }}
        />
        Full session
      </label>
    </fieldset>
  );
}
