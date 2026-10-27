import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/entrypoints/sidepanel/App';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import { resetActionClientMock } from '../helpers/mock-action-client';
import { resetNetworkIssueClientMock } from '../helpers/mock-network-issue-client';
import { resetUiIssueClientMock } from '../helpers/mock-ui-issue-client';
import {
  resetSessionClientMock,
  sessionClientMock,
} from '../helpers/mock-session-client';

function renderSidePanel() {
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

describe('session synchronization', () => {
  beforeEach(() => {
    resetSessionClientMock();
    resetActionClientMock();
    resetNetworkIssueClientMock();
    resetUiIssueClientMock();
  });

  it('updates the side panel when the background broadcasts a new state', async () => {
    renderSidePanel();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Start capture' }),
      ).toBeEnabled();
    });

    sessionClientMock.emitState({
      status: 'recording',
      id: 'session-1',
      startedAt: 1_000,
      pausedAt: null,
      stoppedAt: null,
      ...DEFAULT_TEST_SESSION_TARGET,
    });

    expect(await screen.findByText('Capturing this tab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('reflects command-driven state changes in the UI', async () => {
    const user = userEvent.setup();
    renderSidePanel();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Start capture' }),
      ).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Start capture' }));

    expect(await screen.findByText('Capturing this tab')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByText('Capture paused')).toBeInTheDocument();
  });
});
