import { useState, type FormEvent } from 'react';
import { Button } from '@/src/components/Button';
import { ISSUE_MARK_NOTE_MAX_LENGTH } from '@/src/domain/issue-mark';
import {
  normalizeIssueMarkNote,
  validateIssueMarkNote,
} from '@/src/issue-marks/issue-mark-note';

type CaptureBugNowControlsProps = {
  disabled: boolean;
  onCapture: (input: {
    note?: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
  onStop: () => void;
};

type CapturePhase = 'idle' | 'form' | 'saved';

export function CaptureBugNowControls({
  disabled,
  onCapture,
  onStop,
}: CaptureBugNowControlsProps) {
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [note, setNote] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  function reset(): void {
    setPhase('idle');
    setNote('');
    setFieldError(undefined);
    setSubmitError(undefined);
  }

  async function submit(): Promise<void> {
    const validation = validateIssueMarkNote(note);
    if (validation !== undefined) {
      setFieldError(validation);
      return;
    }
    setSaving(true);
    setSubmitError(undefined);
    const normalized = normalizeIssueMarkNote(note);
    try {
      const result = await onCapture({
        note: normalized.length > 0 ? normalized : undefined,
      });
      if (!result.ok) {
        setSubmitError(result.message);
        return;
      }
      setPhase('saved');
    } catch {
      setSubmitError('Could not capture the bug.');
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submit();
  }

  if (phase === 'saved') {
    return (
      <div
        aria-label="Bug captured"
        className="flex min-w-0 flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60"
      >
        <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
          Bug captured
        </p>
        <Button variant="secondary" type="button" onClick={reset}>
          Continue capture
        </Button>
        <Button type="button" onClick={onStop}>
          Stop and review
        </Button>
      </div>
    );
  }

  if (phase === 'form') {
    return (
      <form
        aria-label="Capture bug form"
        className="flex min-w-0 flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700"
        onSubmit={handleSubmit}
      >
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-slate-800 dark:text-slate-100">
            What went wrong?
          </span>
          <textarea
            className="min-h-[4.5rem] rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-950"
            maxLength={ISSUE_MARK_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setFieldError(undefined);
            }}
            aria-invalid={fieldError !== undefined}
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Optional note, up to {ISSUE_MARK_NOTE_MAX_LENGTH} characters.
          </span>
          {fieldError !== undefined ? (
            <span
              role="alert"
              className="text-sm text-red-800 dark:text-red-200"
            >
              {fieldError}
            </span>
          ) : null}
        </label>
        {submitError !== undefined ? (
          <p role="alert" className="text-sm text-red-800 dark:text-red-200">
            {submitError}
          </p>
        ) : null}
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            Save bug
          </Button>
          <Button
            variant="secondary"
            type="button"
            disabled={saving}
            onClick={reset}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Button
      variant="secondary"
      type="button"
      disabled={disabled}
      onClick={() => {
        setSubmitError(undefined);
        setFieldError(undefined);
        setPhase('form');
      }}
    >
      Capture bug now
    </Button>
  );
}
