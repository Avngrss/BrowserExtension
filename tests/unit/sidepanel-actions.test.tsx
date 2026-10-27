import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/entrypoints/sidepanel/App';
import {
  actionClientMock,
  resetActionClientMock,
} from '../helpers/mock-action-client';
import { resetSessionClientMock } from '../helpers/mock-session-client';

describe('side panel actions', () => {
  beforeEach(() => {
    resetSessionClientMock();
    resetActionClientMock();
  });

  it('counts actions and shows recent activity rows', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Start capture' }),
    );

    actionClientMock.setActions([
      {
        id: 'action-1',
        type: 'navigation',
        sessionId: 'session-a',
        timestamp: 1_000,
        url: 'https://example.com/start',
      },
      {
        id: 'action-2',
        type: 'click',
        sessionId: 'session-a',
        timestamp: 2_000,
        url: 'https://example.com/start',
        element: {
          tagName: 'button',
          visibleText: 'Submit order',
        },
      },
    ]);

    await waitFor(() => {
      const summary = screen.getByLabelText('Capture summary');
      expect(summary).toHaveTextContent('Actions');
      expect(summary).toHaveTextContent('2');
    });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(
      screen.getByText(/Clicked button “Submit order”/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Navigated/)).toBeInTheDocument();
  });
});
