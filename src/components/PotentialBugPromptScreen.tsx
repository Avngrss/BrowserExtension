import { useMemo, useState, type SyntheticEvent } from 'react';
import { BugTicketScreenshot } from '@/src/components/BugTicketScreenshot';
import { Button } from '@/src/components/Button';
import {
  buildBugTicketDraft,
  formatBugTicketDraft,
} from '@/src/bug-report/bug-ticket-draft';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type { PotentialBug } from '@/src/domain/potential-bug';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import type { UiIssue } from '@/src/domain/ui-issue';
import {
  potentialBugTitle,
  selectPotentialBugScreenshots,
} from '@/src/potential-bugs/potential-bug-description';
import { STEPS_FOR_BUG_TICKET_MODE_LABEL } from '@/src/prompt/steps-for-bug-ticket-prompt';

type PotentialBugPromptScreenProps = {
  potentialBugs: PotentialBug[];
  bugId: string | null;
  uiIssues: UiIssue[];
  consoleIssues: ConsoleIssue[];
  networkIssues: NetworkIssue[];
  screenshotEvidence: ScreenshotEvidence[];
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
  onBack,
}: PotentialBugPromptScreenProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );
  const index = potentialBugs.findIndex((bug) => bug.id === bugId);
  const bug = index === -1 ? undefined : potentialBugs[index];
  const lookup = useMemo(
    () => ({ uiIssues, consoleIssues, networkIssues }),
    [uiIssues, consoleIssues, networkIssues],
  );

  const ticket = useMemo(
    () =>
      bug === undefined
        ? ''
        : formatBugTicketDraft(buildBugTicketDraft(bug, lookup)),
    [bug, lookup],
  );
  const shots =
    bug === undefined
      ? []
      : selectPotentialBugScreenshots(bug, screenshotEvidence);

  async function copyTicket(): Promise<void> {
    try {
      await navigator.clipboard.writeText(ticket);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <section
      aria-label="Bug ticket screen"
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
          <BugTicketScreenshot evidence={shots} />
          <textarea
            readOnly
            aria-label="Draft ticket"
            className="min-h-[18rem] w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            value={ticket}
            onFocus={selectWholePrompt}
            onClick={selectWholePrompt}
          />
          <Button type="button" onClick={() => void copyTicket()}>
            Copy ticket
          </Button>
          {copyStatus === 'copied' ? (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Ticket copied.
            </p>
          ) : null}
          {copyStatus === 'failed' ? (
            <p role="alert" className="text-xs text-red-700 dark:text-red-300">
              Copy failed. Click the ticket and copy it from the keyboard.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
