import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/entrypoints/sidepanel/App';
import { SETTINGS_OPEN_FAILED_MESSAGE } from '@/src/utils/extension-pages';
import {
  extensionBrowserMock,
  resetExtensionBrowserMock,
} from '../helpers/mock-extension-browser';
import { resetActionClientMock } from '../helpers/mock-action-client';
import { resetNetworkIssueClientMock } from '../helpers/mock-network-issue-client';
import { resetUiIssueClientMock } from '../helpers/mock-ui-issue-client';
import { resetSessionClientMock } from '../helpers/mock-session-client';

function renderSidePanel() {
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

describe('side panel', () => {
  beforeEach(() => {
    resetExtensionBrowserMock();
    resetSessionClientMock();
    resetActionClientMock();
    resetNetworkIssueClientMock();
    resetUiIssueClientMock();
  });

  it('shows compact capture summary and recent activity when idle', async () => {
    renderSidePanel();

    expect(
      screen.getByRole('heading', { name: 'Bug Capture Assistant' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Start capture' }),
      ).toBeEnabled();
    });
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Potential issues')).toBeInTheDocument();
    expect(screen.getByText('Recent activity')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'UI' }),
    ).not.toBeInTheDocument();
  });

  it('shows session controls for each state', async () => {
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
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(await screen.findByText('Capturing this tab')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stop and review' }));
    expect(
      await screen.findByRole('region', { name: 'Session Summary' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start new capture' }),
    ).toBeInTheDocument();
  });

  it('keeps keyboard focus styles on the settings button', () => {
    renderSidePanel();

    const settingsButton = screen.getByRole('button', {
      name: 'Settings',
    });
    expect(settingsButton.className).toContain('focus-visible:outline-2');

    settingsButton.focus();
    expect(settingsButton).toHaveFocus();
  });

  it('opens settings through the extension client', async () => {
    const user = userEvent.setup();
    renderSidePanel();

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(extensionBrowserMock.openOptionsPage).toHaveBeenCalledOnce();
  });

  it('shows a concise message when settings cannot be opened', async () => {
    const user = userEvent.setup();
    extensionBrowserMock.openOptionsPage.mockRejectedValue(
      new Error('blocked'),
    );
    renderSidePanel();

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      SETTINGS_OPEN_FAILED_MESSAGE,
    );
  });
});
