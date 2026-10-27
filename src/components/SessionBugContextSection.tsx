import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/src/components/Button';
import { BUG_REPORT_CONTEXT_FIELD_MAX_LENGTH } from '@/src/domain/bug-report-context';
import { validateBugReportContextField } from '@/src/bug-report/bug-report-context-fields';

type SessionBugContextSectionProps = {
  sessionId: string;
  savedWhatHappened?: string;
  savedWhatWasExpected?: string;
  factualDraft?: string;
  bugContextEverSaved: boolean;
  focusWhatHappenedRequest?: number;
  saving: boolean;
  onSave: (input: {
    whatHappened?: string;
    whatWasExpected?: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
};

export function SessionBugContextSection({
  sessionId,
  savedWhatHappened,
  savedWhatWasExpected,
  factualDraft,
  bugContextEverSaved,
  focusWhatHappenedRequest = 0,
  saving,
  onSave,
}: SessionBugContextSectionProps) {
  const [whatHappened, setWhatHappened] = useState('');
  const [whatWasExpected, setWhatWasExpected] = useState('');
  const [happenedError, setHappenedError] = useState<string | undefined>(
    undefined,
  );
  const [expectedError, setExpectedError] = useState<string | undefined>(
    undefined,
  );
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const whatHappenedRef = useRef<HTMLTextAreaElement>(null);
  const userEditedWhatHappened = useRef(false);

  useEffect(() => {
    if (savedWhatHappened !== undefined) {
      userEditedWhatHappened.current = false;
      setWhatHappened(savedWhatHappened);
    } else if (userEditedWhatHappened.current) {
      // Keep in-progress edits when evidence loads asynchronously.
    } else if (!bugContextEverSaved) {
      setWhatHappened(factualDraft ?? '');
    } else {
      userEditedWhatHappened.current = false;
      setWhatHappened('');
    }
    setWhatWasExpected(savedWhatWasExpected ?? '');
    setHappenedError(undefined);
    setExpectedError(undefined);
    setSubmitError(undefined);
  }, [
    sessionId,
    savedWhatHappened,
    savedWhatWasExpected,
    factualDraft,
    bugContextEverSaved,
  ]);

  useEffect(() => {
    if (focusWhatHappenedRequest === 0) {
      return;
    }
    whatHappenedRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
    whatHappenedRef.current?.focus();
  }, [focusWhatHappenedRequest]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const happenedValidation = validateBugReportContextField(
      whatHappened,
      'What happened?',
    );
    const expectedValidation = validateBugReportContextField(
      whatWasExpected,
      'What was expected?',
    );
    setHappenedError(happenedValidation);
    setExpectedError(expectedValidation);
    if (happenedValidation !== undefined || expectedValidation !== undefined) {
      return;
    }
    setSubmitError(undefined);
    const result = await onSave({
      whatHappened,
      whatWasExpected,
    });
    if (!result.ok) {
      setSubmitError(result.message);
    }
  }

  return (
    <form
      id="session-bug-context"
      aria-label="Bug context"
      className="flex min-w-0 flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <h3 className="text-xs font-semibold text-slate-950 dark:text-slate-50">
        Bug context
      </h3>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-slate-800 dark:text-slate-100">
          What happened?
        </span>
        <textarea
          ref={whatHappenedRef}
          aria-label="What happened?"
          className="min-h-[3rem] rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-950"
          maxLength={BUG_REPORT_CONTEXT_FIELD_MAX_LENGTH}
          value={whatHappened}
          onChange={(event) => {
            userEditedWhatHappened.current = true;
            setWhatHappened(event.target.value);
            setHappenedError(undefined);
          }}
          aria-invalid={happenedError !== undefined}
        />
        {happenedError !== undefined ? (
          <span role="alert" className="text-sm text-red-800 dark:text-red-200">
            {happenedError}
          </span>
        ) : null}
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-slate-800 dark:text-slate-100">
          What was expected?
        </span>
        <textarea
          aria-label="What was expected?"
          className="min-h-[3rem] rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-950"
          maxLength={BUG_REPORT_CONTEXT_FIELD_MAX_LENGTH}
          value={whatWasExpected}
          onChange={(event) => {
            setWhatWasExpected(event.target.value);
            setExpectedError(undefined);
          }}
          aria-invalid={expectedError !== undefined}
        />
        {expectedError !== undefined ? (
          <span role="alert" className="text-sm text-red-800 dark:text-red-200">
            {expectedError}
          </span>
        ) : null}
      </label>
      {submitError !== undefined ? (
        <p role="alert" className="text-sm text-red-800 dark:text-red-200">
          {submitError}
        </p>
      ) : null}
      <Button type="submit" disabled={saving}>
        Save context
      </Button>
    </form>
  );
}
