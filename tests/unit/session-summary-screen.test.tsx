import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionSummaryScreen } from '@/src/components/SessionSummaryScreen';
import type { UseSessionStateResult } from '@/src/hooks/useSessionState';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import {
  SESSION_ID,
  clickAction,
  consoleIssue,
  potentialBug,
  uiIssue,
} from '../helpers/potential-bug-fixtures';

function stoppedSession(): UseSessionStateResult {
  return {
    snapshot: {
      status: 'stopped',
      id: SESSION_ID,
      startedAt: 1,
      pausedAt: null,
      stoppedAt: 2,
      ...DEFAULT_TEST_SESSION_TARGET,
    },
    status: 'stopped',
    statusLabel: 'Stopped',
    loading: false,
    processing: false,
    error: undefined,
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    startNewCapture: vi.fn(),
    deleteSession: vi.fn(),
  };
}

function renderSummary(
  overrides: Partial<Parameters<typeof SessionSummaryScreen>[0]> = {},
) {
  const props: Parameters<typeof SessionSummaryScreen>[0] = {
    session: stoppedSession(),
    actions: [clickAction('a1', 1, 'Pay'), clickAction('a2', 2)],
    actionCount: 2,
    finalizingScreenshots: false,
    potentialBugs: [],
    uiIssues: [uiIssue('u1')],
    consoleIssues: [consoleIssue('c1')],
    networkIssues: [],
    onGeneratePrompt: vi.fn(),
    onReviewIssues: vi.fn(),
    onSetBugStatus: vi.fn(),
    onStartNewCapture: vi.fn(),
    onDeleteSession: vi.fn(),
    ...overrides,
  };
  render(<SessionSummaryScreen {...props} />);
  return props;
}

function expectRemovedReportUi(): void {
  for (const name of [
    'Describe a problem',
    'Document actions',
    'View details',
  ]) {
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  }
  expect(screen.queryByLabelText('Bug context')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Report scope')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Bug report preview')).not.toBeInTheDocument();
}

describe('SessionSummaryScreen', () => {
  it('shows a completed session without potential bugs', async () => {
    const user = userEvent.setup();
    renderSummary();

    const result = screen.getByLabelText('Session result');
    expect(within(result).getByText('Session completed')).toBeInTheDocument();
    expect(
      within(result).getByText('No potential bugs detected'),
    ).toBeInTheDocument();
    expect(within(result).getByText('2 recorded Actions')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start new capture' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete session' }),
    ).toBeInTheDocument();
    expectRemovedReportUi();

    await user.click(screen.getByRole('button', { name: 'View activity' }));
    const activity = screen.getByLabelText('Recorded activity');
    expect(activity).toHaveTextContent('Clicked “Pay”.');
    expect(activity).not.toHaveTextContent('Clicked a button.');
  });

  it('shows one compact card for a single potential bug', async () => {
    const user = userEvent.setup();
    const props = renderSummary({
      potentialBugs: [
        potentialBug('bug-1', {
          actions: [{ actionId: 'a1', step: 'Clicked “Pay”.' }],
          issues: [
            { category: 'console', issueId: 'c1' },
            { category: 'ui', issueId: 'u1' },
          ],
        }),
      ],
    });

    expect(
      screen.getByRole('heading', { name: '1 potential bug captured' }),
    ).toBeInTheDocument();
    const card = screen.getByRole('article', { name: 'Potential bug 1' });
    expect(
      within(card).getByLabelText('Factual description'),
    ).toHaveTextContent('The page shows “Payment unavailable”.');
    expect(card).not.toHaveTextContent('relevant Action');
    expect(card).not.toHaveTextContent('related issue');
    expect(screen.queryByText('Coming next')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Session result')).not.toBeInTheDocument();
    expectRemovedReportUi();

    await user.click(
      within(card).getByRole('button', { name: 'Generate prompt' }),
    );
    expect(props.onGeneratePrompt).toHaveBeenCalledWith('bug-1');
    await user.click(within(card).getByRole('button', { name: 'Review' }));
    expect(props.onReviewIssues).toHaveBeenCalledOnce();
    await user.click(within(card).getByRole('button', { name: 'Exclude' }));
    expect(props.onSetBugStatus).toHaveBeenCalledWith('bug-1', 'excluded');
  });

  it('lists multiple bugs and counts only included ones in the headline', () => {
    renderSummary({
      potentialBugs: [
        potentialBug('bug-1', {
          issues: [{ category: 'ui', issueId: 'u1' }],
        }),
        potentialBug('bug-2', { source: 'manual', note: 'Wrong total' }),
        potentialBug('bug-3', { status: 'excluded' }),
        potentialBug('other-session', { sessionId: 'session-2' }),
      ],
    });

    expect(
      screen.getByRole('heading', { name: '2 potential bugs captured' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    const manual = screen.getByRole('article', { name: 'Potential bug 2' });
    expect(manual).toHaveTextContent('Captured manually');
    expect(manual).toHaveTextContent('Wrong total');
    const excluded = screen.getByRole('article', { name: 'Potential bug 3' });
    expect(within(excluded).getByText('Excluded')).toBeInTheDocument();
    expect(
      within(excluded).getByRole('button', { name: 'Include' }),
    ).toBeInTheDocument();
    const excludedPrompt = within(excluded).getByRole('button', {
      name: 'Generate prompt',
    });
    expect(excludedPrompt).toBeDisabled();
    expect(excludedPrompt).toHaveAccessibleDescription(
      'Include this bug to generate a prompt.',
    );
    expect(
      within(manual).getByRole('button', { name: 'Generate prompt' }),
    ).toBeEnabled();
  });
});
