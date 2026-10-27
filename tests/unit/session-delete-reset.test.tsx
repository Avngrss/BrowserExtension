import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/entrypoints/sidepanel/App';
import type { CapturedAction } from '@/src/domain/action';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import { isActiveSession } from '@/src/domain/session';
import {
  actionClientMock,
  resetActionClientMock,
} from '../helpers/mock-action-client';
import { consoleIssueClientMock } from '../helpers/mock-console-issue-client';
import { resetConsoleIssueClientMock } from '../helpers/mock-console-issue-client';
import { resetNetworkIssueClientMock } from '../helpers/mock-network-issue-client';
import { resetUiIssueClientMock } from '../helpers/mock-ui-issue-client';
import {
  resetSessionClientMock,
  sessionClientMock,
} from '../helpers/mock-session-client';
import { resetScreenshotEvidenceClientMock } from '../helpers/mock-screenshot-evidence-client';
import { potentialBugClientMock } from '../helpers/mock-potential-bug-client';
import { potentialBug } from '../helpers/potential-bug-fixtures';

const stoppedAction: CapturedAction = {
  id: 'action-1',
  sessionId: 'session-a',
  timestamp: 1,
  url: 'https://example.test/',
  type: 'click',
  element: { tagName: 'button' },
};

const stoppedIssue: ConsoleIssue = {
  id: 'issue-1',
  sessionId: 'session-a',
  timestamp: 1,
  lastSeenAt: 1,
  category: 'console-error',
  url: 'https://example.test/',
  message: 'BCA stale test',
  occurrenceCount: 1,
  disposition: 'unexpected',
};

function renderSidePanel() {
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

describe('side panel session delete reset', () => {
  beforeEach(() => {
    resetSessionClientMock();
    resetActionClientMock();
    resetConsoleIssueClientMock();
    resetNetworkIssueClientMock();
    resetUiIssueClientMock();
    resetScreenshotEvidenceClientMock();
    sessionClientMock.setDeleteSessionShouldFail(false);
  });

  async function openStoppedSummaryWithData(): Promise<
    ReturnType<typeof renderSidePanel>
  > {
    const user = userEvent.setup();
    const view = renderSidePanel();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Start capture' }),
      ).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Start capture' }));
    await user.click(screen.getByRole('button', { name: 'Stop and review' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Session Summary' }),
      ).toBeInTheDocument();
    });

    const snapshot = sessionClientMock.getStore().getState();
    const sessionId = isActiveSession(snapshot) ? snapshot.id : 'session-a';
    actionClientMock.setActions([{ ...stoppedAction, sessionId }]);
    consoleIssueClientMock.setIssues([{ ...stoppedIssue, sessionId }]);
    potentialBugClientMock.setBugs([
      potentialBug('bug-1', {
        sessionId,
        issues: [{ category: 'console', issueId: stoppedIssue.id }],
      }),
    ]);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: '1 potential bug captured' }),
      ).toBeInTheDocument();
    });

    return view;
  }

  it('clears visible session data immediately after successful deletion', async () => {
    const user = userEvent.setup();
    await openStoppedSummaryWithData();

    await user.click(screen.getByRole('button', { name: 'Delete session' }));
    await user.click(
      screen.getAllByRole('button', { name: 'Delete session' }).at(-1)!,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Start capture' }),
      ).toBeEnabled();
    });
    expect(
      screen.queryByRole('heading', { name: 'Session Summary' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/No activity yet/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Capture summary')).toHaveTextContent(
      'Actions0',
    );
  });

  it('ignores stale data broadcasts after the session becomes idle', async () => {
    const user = userEvent.setup();
    await openStoppedSummaryWithData();

    await user.click(screen.getByRole('button', { name: 'Delete session' }));
    await user.click(
      screen.getAllByRole('button', { name: 'Delete session' }).at(-1)!,
    );

    await waitFor(() => {
      expect(screen.getByText(/No activity yet/i)).toBeInTheDocument();
    });

    actionClientMock.setActions([stoppedAction]);
    consoleIssueClientMock.setIssues([stoppedIssue]);

    await waitFor(() => {
      expect(screen.getByText(/No activity yet/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('BCA stale test')).not.toBeInTheDocument();
  });

  it('preserves reviewing data when deletion fails', async () => {
    const user = userEvent.setup();
    sessionClientMock.setDeleteSessionShouldFail(true);
    await openStoppedSummaryWithData();

    await user.click(screen.getByRole('button', { name: 'Delete session' }));
    await user.click(
      screen.getAllByRole('button', { name: 'Delete session' }).at(-1)!,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Session Summary' }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole('article', { name: 'Potential bug 1' }),
    ).toBeInTheDocument();
  });

  it('stays empty after reopening the side panel following deletion', async () => {
    const user = userEvent.setup();
    const view = await openStoppedSummaryWithData();

    await user.click(screen.getByRole('button', { name: 'Delete session' }));
    await user.click(
      screen.getAllByRole('button', { name: 'Delete session' }).at(-1)!,
    );

    await waitFor(() => {
      expect(screen.getByText(/No activity yet/i)).toBeInTheDocument();
    });

    view.unmount();
    renderSidePanel();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Start capture' }),
      ).toBeEnabled();
    });
    expect(screen.getByText(/No activity yet/i)).toBeInTheDocument();
  });

  it('repeats Delete-to-Start without showing bugs from deleted sessions', async () => {
    const user = userEvent.setup();
    await openStoppedSummaryWithData();

    for (let cycle = 0; cycle < 2; cycle += 1) {
      await user.click(screen.getByRole('button', { name: 'Delete session' }));
      await user.click(
        screen.getAllByRole('button', { name: 'Delete session' }).at(-1)!,
      );
      await user.click(
        await screen.findByRole('button', { name: 'Start capture' }),
      );
      await user.click(
        await screen.findByRole('button', { name: 'Stop and review' }),
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Session result')).toHaveTextContent(
          'No potential bugs detected',
        );
      });
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    }
  });
});
