import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PotentialBugPromptScreen } from '@/src/components/PotentialBugPromptScreen';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import {
  SESSION_ID,
  potentialBug,
  uiIssue,
} from '../helpers/potential-bug-fixtures';

vi.mock('@/src/utils/screenshot-blob-loader', () => ({
  loadScreenshotBlobUrl: vi.fn(() =>
    Promise.resolve('blob:http://localhost/shot'),
  ),
}));

const capturedScreenshot: ScreenshotEvidence = {
  id: 'frame-1:ui:u1',
  frameId: 'frame-1',
  sessionId: SESSION_ID,
  issueCategory: 'ui',
  issueId: 'u1',
  capturedAt: 1_000,
  pageUrl: 'https://shop.test/checkout',
  width: 800,
  height: 600,
  format: 'jpeg',
  storageRef: 'frame-1',
  status: 'captured',
  linkedIssueCount: 1,
};

function renderPromptScreen(bugId: string | null) {
  const onBack = vi.fn();
  render(
    <PotentialBugPromptScreen
      potentialBugs={[
        potentialBug('bug-1', {
          actions: [{ actionId: 'a1', step: 'Clicked “Pay”.' }],
          issues: [{ category: 'ui', issueId: 'u1' }],
        }),
      ]}
      bugId={bugId}
      uiIssues={[uiIssue('u1')]}
      consoleIssues={[]}
      networkIssues={[]}
      screenshotEvidence={[capturedScreenshot]}
      onBack={onBack}
    />,
  );
  return { onBack };
}

describe('PotentialBugPromptScreen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a draft ticket, screenshot, and copies the ticket', async () => {
    const user = userEvent.setup();
    const { onBack } = renderPromptScreen('bug-1');

    expect(
      screen.getByRole('heading', { name: 'Bug ticket' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Bug 1 · /checkout')).toBeInTheDocument();
    const field = screen.getByLabelText<HTMLTextAreaElement>('Draft ticket');
    expect(field).toHaveAttribute('readonly');
    expect(field.value).toContain('[Checkout] Payment unavailable');
    expect(field.value).toContain('1. Clicked “Pay”.');
    expect(field.value).not.toContain('You are a Senior QA Engineer.');
    expect(
      screen.queryByRole('button', { name: 'Copy prompt' }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByAltText('Bug screenshot')).toBeInTheDocument();
    });

    await user.click(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(field.value.length);

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText },
    });
    await user.click(screen.getByRole('button', { name: 'Copy ticket' }));
    expect(writeText).toHaveBeenCalledWith(field.value);
    expect(screen.getByText('Ticket copied.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to summary' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('explains when the selected bug is gone', () => {
    renderPromptScreen('deleted-bug');

    expect(
      screen.getByText('This potential bug is no longer available.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Draft ticket')).not.toBeInTheDocument();
  });
});
