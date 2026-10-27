import { render, screen, waitFor } from '@testing-library/react';
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

describe('session loading UI', () => {
  beforeEach(() => {
    resetSessionClientMock();
    resetActionClientMock();
    resetNetworkIssueClientMock();
    resetUiIssueClientMock();
  });

  it('does not flash idle before the initial session load completes', async () => {
    let resolveGetState:
      | ((
          value: Awaited<ReturnType<typeof sessionClientMock.getState>>,
        ) => void)
      | undefined;
    let pendingGetState:
      | Promise<Awaited<ReturnType<typeof sessionClientMock.getState>>>
      | undefined;
    sessionClientMock.setGetStateOverride(() => {
      pendingGetState ??= new Promise((resolve) => {
        resolveGetState = resolve;
      });
      return pendingGetState;
    });

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(
      screen.getByRole('button', { name: 'Start capture' }),
    ).toBeDisabled();

    resolveGetState?.({
      ok: true,
      revision: 2,
      state: {
        status: 'recording',
        id: 'session-1',
        startedAt: 1,
        pausedAt: null,
        stoppedAt: null,
        ...DEFAULT_TEST_SESSION_TARGET,
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Starting capture|Capturing this tab/),
    ).toBeInTheDocument();
  });
});
