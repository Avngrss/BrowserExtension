import { useMemo, useState, type SyntheticEvent } from 'react';
import { Button } from '@/src/components/Button';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type { PotentialBug } from '@/src/domain/potential-bug';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import type { UiIssue } from '@/src/domain/ui-issue';
import {
  countPotentialBugScreenshots,
  potentialBugTitle,
} from '@/src/potential-bugs/potential-bug-description';
import {
  STEPS_FOR_BUG_TICKET_MODE_LABEL,
  buildStepsForBugTicketPrompt,
} from '@/src/prompt/steps-for-bug-ticket-prompt';

type PotentialBugPromptScreenProps = {
  potentialBugs: PotentialBug[];
  bugId: string | null;
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
  screenshotEvidence: ScreenshotEvidence[];
  extraInstructions: string;
  onBack: () => void;
};

function selectWholePrompt(event: SyntheticEvent<HTMLTextAreaElement>): void {
  const field = event.currentTarget;
  if (field.selectionStart === field.selectionEnd) {
    field.select();
  }
}

export function PotentialBugPromptScreen({
  potentialBugs,
  bugId,
  uiIssues,
  consoleIssues,
  networkIssues,
  screenshotEvidence,
  extraInstructions,
  onBack,
}: PotentialBugPromptScreenProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );
  const index = potentialBugs.findIndex((bug) => bug.id === bugId);
  const bug = index === -1 ? undefined : potentialBugs[index];

  const prompt = useMemo(
    () =>
      bug === undefined
        ? ''
        : buildStepsForBugTicketPrompt(
            bug,
            { uiIssues, consoleIssues, networkIssues },
            countPotentialBugScreenshots(bug, screenshotEvidence),
            extraInstructions,
          ),
    [
      bug,
      uiIssues,
      consoleIssues,
      networkIssues,
      screenshotEvidence,
      extraInstructions,
    ],
  );

  async function copyPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <section
      aria-label="Bug ticket prompt"
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
          {STEPS_FOR_BUG_TICKET_MODE_LABEL}
        </h2>
        <Button variant="secondary" type="button" onClick={onBack}>
          Back to summary
        </Button>
      </div>

      {bug === undefined ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          This potential bug is no longer available.
        </p>
      ) : (
        <>
          <p className="min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">
            {potentialBugTitle(bug, index)} · {bug.page.pathname}
          </p>
          <textarea
            readOnly
            aria-label="Generated prompt"
            className="min-h-[18rem] w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            value={prompt}
            onFocus={selectWholePrompt}
            onClick={selectWholePrompt}
          />
          <Button type="button" onClick={() => void copyPrompt()}>
            Copy prompt
          </Button>
          {copyStatus === 'copied' ? (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Copied.
            </p>
          ) : null}
          {copyStatus === 'failed' ? (
            <p role="alert" className="text-xs text-red-700 dark:text-red-300">
              Copy failed. Click the prompt and copy it from the keyboard.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
