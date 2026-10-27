import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiIssueRulesPanel } from '@/src/components/UiIssueRulesPanel';
import { DEFAULT_UI_ISSUE_RULES } from '@/src/ui/default-ui-rules';
import { UI_ISSUE_RULE_SELECTOR_ERROR } from '@/src/ui/ui-rule-form-validation';
import {
  resetUiRuleClientMock,
  uiRuleClientMock,
} from '../helpers/mock-ui-rule-client';

describe('UiIssueRulesPanel', () => {
  beforeEach(() => {
    resetUiRuleClientMock();
  });

  it('renders default rules with stable keys and field-specific selector errors', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <UiIssueRulesPanel />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByText('Alert role')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(
      DEFAULT_UI_ISSUE_RULES.length,
    );

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Broken bracket' },
    });
    fireEvent.change(screen.getByLabelText('CSS selector'), {
      target: { value: '[role="alert"' },
    });
    await user.click(screen.getByRole('button', { name: 'Add rule' }));

    expect(
      await screen.findByText(UI_ISSUE_RULE_SELECTOR_ERROR),
    ).toBeInTheDocument();
    expect(screen.getByText('Alert role')).toBeInTheDocument();
  });

  it('keeps the panel usable when saving fails', async () => {
    const user = userEvent.setup();
    uiRuleClientMock.setSaveShouldFail(true);
    render(
      <StrictMode>
        <UiIssueRulesPanel />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByText('Alert role')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Generic alert' },
    });
    fireEvent.change(screen.getByLabelText('CSS selector'), {
      target: { value: '[role="alert"]' },
    });
    await user.click(screen.getByRole('button', { name: 'Add rule' }));

    expect(
      await screen.findByText('UI issue rules could not be saved.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Alert role')).toBeInTheDocument();
  });

  it('survives malformed loaded rules without clearing the settings page', async () => {
    uiRuleClientMock.setLoadShouldReturnMalformed(true);
    render(
      <StrictMode>
        <UiIssueRulesPanel />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'UI issue rules' }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
