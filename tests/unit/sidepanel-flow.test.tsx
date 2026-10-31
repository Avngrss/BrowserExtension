import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/entrypoints/sidepanel/App';
import {
  consoleIssueClientMock,
  resetConsoleIssueClientMock,
} from '../helpers/mock-console-issue-client';
import { resetNetworkIssueClientMock } from '../helpers/mock-network-issue-client';
import { resetActionClientMock } from '../helpers/mock-action-client';
import { resetSessionClientMock } from '../helpers/mock-session-client';
import {
  resetUiIssueClientMock,
  uiIssueClientMock,
} from '../helpers/mock-ui-issue-client';
import { resetIssueDispositionClientMock } from '../helpers/mock-issue-disposition-client';
import { potentialBugClientMock } from '../helpers/mock-potential-bug-client';
import { potentialBug } from '../helpers/potential-bug-fixtures';

function seedPotentialBug(): void {
  potentialBugClientMock.setBugs([
    potentialBug('bug-1', {
      sessionId: 'session-a',
      issues: [{ category: 'ui', issueId: 'ui-1' }],
    }),
  ]);
}

function renderSidePanel() {
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

describe('side panel capture flow', () => {
  beforeEach(() => {
    resetSessionClientMock();
    resetActionClientMock();
    resetConsoleIssueClientMock();
    resetNetworkIssueClientMock();
    resetUiIssueClientMock();
    resetIssueDispositionClientMock();
  });

  it('shows Start capture and combined potential issues on idle', async () => {
    renderSidePanel();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Start capture' }),
      ).toBeEnabled();
    });

    expect(screen.getByText('Potential issues')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Actions and potential issues are captured automatically/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Include' }),
    ).not.toBeInTheDocument();
  });

  it('shows only the latest five timeline events during capture', async () => {
    const user = userEvent.setup();
    const actions = Array.from({ length: 7 }, (_, index) => ({
      id: `action-${index}`,
      type: 'navigation' as const,
      sessionId: 'session-a',
      timestamp: index + 1,
      url: `https://example.com/${index}`,
    }));
    const { actionClientMock } = await import('../helpers/mock-action-client');

    renderSidePanel();
    await user.click(
      await screen.findByRole('button', { name: 'Start capture' }),
    );
    actionClientMock.setActions(actions);

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(5);
    });
  });

  it('opens Session Summary after Stop and review', async () => {
    const user = userEvent.setup();
    renderSidePanel();

    await user.click(
      await screen.findByRole('button', { name: 'Start capture' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Stop and review' }),
    );

    expect(
      await screen.findByRole('region', { name: 'Session Summary' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Session result')).toHaveTextContent(
      'No potential bugs detected',
    );
    expect(
      screen.getByRole('button', { name: 'View activity' }),
    ).toBeInTheDocument();
  });

  it('reopens stopped sessions on Session Summary', async () => {
    const user = userEvent.setup();
    renderSidePanel();

    await user.click(
      await screen.findByRole('button', { name: 'Start capture' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Stop and review' }),
    );
    await screen.findByRole('region', { name: 'Session Summary' });

    renderSidePanel();
    expect(
      await screen.findByRole('region', { name: 'Session Summary' }),
    ).toBeInTheDocument();
  });

  it('shows review issues without actions and maps include/exclude', async () => {
    const user = userEvent.setup();
    uiIssueClientMock.setIssues([
      {
        id: 'ui-1',
        sessionId: 'session-a',
        timestamp: 1,
        lastSeenAt: 1,
        ruleId: 'rule-1',
        ruleName: 'Alert',
        severity: 'error',
        visibleMessage: 'Email is required',
        url: 'https://example.com/',
        element: { tagName: 'div', visibleText: 'Email is required' },
        occurrenceCount: 1,
        disposition: 'unexpected',
      },
    ]);
    consoleIssueClientMock.setIssues([
      {
        id: 'console-1',
        sessionId: 'session-a',
        timestamp: 2,
        lastSeenAt: 2,
        category: 'uncaught-error',
        message: 'Boom',
        url: 'https://example.com/',
        occurrenceCount: 2,
        disposition: 'unexpected',
      },
    ]);
    const { actionClientMock } = await import('../helpers/mock-action-client');
    actionClientMock.setActions([
      {
        id: 'action-1',
        type: 'click',
        sessionId: 'session-a',
        timestamp: 3,
        url: 'https://example.com/',
        element: { tagName: 'button', visibleText: 'Go' },
      },
    ]);
    seedPotentialBug();

    renderSidePanel();
    await user.click(
      await screen.findByRole('button', { name: 'Start capture' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Stop and review' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Issues' }));

    const review = screen.getByRole('region', { name: 'Issue Review' });
    expect(
      within(review).queryByText(/Clicked button/),
    ).not.toBeInTheDocument();
    expect(within(review).getByText(/Email is required/)).toBeInTheDocument();

    await user.click(
      within(review).getByRole('button', { name: 'Exclude ui issue' }),
    );
    expect(uiIssueClientMock.getIssuesSnapshot()[0]?.disposition).toBe(
      'excluded',
    );

    const consoleRow = within(review).getByText(/Boom/).closest('li')!;
    await user.click(within(consoleRow).getByText('More'));
    await user.click(
      within(consoleRow).getByRole('button', { name: 'Mark as expected' }),
    );
    expect(consoleIssueClientMock.getIssuesSnapshot()[0]?.disposition).toBe(
      'expected',
    );
  });

  it('keeps primary controls focusable at narrow width', async () => {
    renderSidePanel();
    const main = screen.getByRole('main');
    expect(main.className).toContain('overflow-x-hidden');

    const start = await screen.findByRole('button', { name: 'Start capture' });
    start.focus();
    expect(start).toHaveFocus();
  });

  it('returns from review to summary and starts a new capture', async () => {
    const user = userEvent.setup();
    uiIssueClientMock.setIssues([
      {
        id: 'ui-1',
        sessionId: 'session-a',
        timestamp: 1,
        lastSeenAt: 1,
        ruleId: 'rule-1',
        ruleName: 'Alert',
        severity: 'error',
        visibleMessage: 'Email is required',
        url: 'https://example.com/',
        element: { tagName: 'div', visibleText: 'Email is required' },
        occurrenceCount: 1,
        disposition: 'unexpected',
      },
    ]);
    seedPotentialBug();
    renderSidePanel();

    await user.click(
      await screen.findByRole('button', { name: 'Start capture' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Stop and review' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Issues' }));
    await user.click(screen.getByRole('button', { name: 'Back to summary' }));

    expect(
      screen.getByRole('region', { name: 'Session Summary' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('article', { name: 'Potential bug 1' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start new capture' }));
    await user.click(
      screen.getAllByRole('button', { name: 'Start new capture' }).at(-1)!,
    );
    expect(await screen.findByLabelText('Capture')).toBeInTheDocument();
  });
});
