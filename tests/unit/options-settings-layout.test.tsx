import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/entrypoints/options/App';
import { resetUiRuleClientMock } from '../helpers/mock-ui-rule-client';

describe('options settings layout', () => {
  beforeEach(() => {
    resetUiRuleClientMock();
  });

  it('shows capture collectors and collapses advanced UI rules by default', () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(
      screen.getByRole('heading', { name: 'Capture' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Capture actions')).toBeInTheDocument();
    expect(screen.getByText('Capture UI issues')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The current tab is selected automatically when you start capture. No URL setup is required.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Bug ticket prompt' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Extra instructions'),
    ).not.toBeInTheDocument();

    const advanced = screen
      .getByText('Advanced UI issue rules')
      .closest('details')!;
    expect(advanced).not.toHaveAttribute('open');

    expect(within(advanced).getByLabelText('Name')).not.toBeVisible();
  });

  it('expands advanced UI rules and keeps the editor usable', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await user.click(screen.getByText('Advanced UI issue rules'));

    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'UI issue rules' }),
    ).toBeInTheDocument();
  });
});
