import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CaptureTimeline } from '@/src/components/CaptureTimeline';

describe('CaptureTimeline', () => {
  it('renders console issues and actions in plain text', () => {
    render(
      <CaptureTimeline
        entries={[
          {
            kind: 'console-issue',
            timestamp: 1,
            issue: {
              id: 'issue-1',
              sessionId: 'session-1',
              timestamp: 1,
              lastSeenAt: 3,
              category: 'uncaught-error',
              message: 'Cannot read properties of undefined',
              url: 'https://example.com/checkout',
              occurrenceCount: 3,
              disposition: 'unexpected',
            },
          },
          {
            kind: 'action',
            timestamp: 2,
            action: {
              id: 'action-1',
              type: 'click',
              sessionId: 'session-1',
              timestamp: 2,
              url: 'https://example.com/checkout',
              element: {
                tagName: 'button',
                semanticType: 'button',
                accessibleName: 'Pay',
              },
            },
          },
        ]}
      />,
    );

    expect(
      screen.getByText(
        /Uncaught error: Cannot read properties of undefined · \/checkout · 3 occurrences/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Clicked button “Pay” · \/checkout/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/issue-1/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does not render HTML from issue messages', () => {
    render(
      <CaptureTimeline
        entries={[
          {
            kind: 'console-issue',
            timestamp: 1,
            issue: {
              id: 'issue-x',
              sessionId: 'session-1',
              timestamp: 1,
              lastSeenAt: 1,
              category: 'console-error',
              message: '<script>alert(1)</script>',
              url: 'https://example.com/',
              occurrenceCount: 1,
              disposition: 'unexpected',
            },
          },
        ]}
      />,
    );

    expect(
      screen.getByText(/Console error: <script>alert\(1\)<\/script> · \//),
    ).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });

  it('shows disposition controls only for issues with accessible names', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CaptureTimeline
        entries={[
          {
            kind: 'console-issue',
            timestamp: 1,
            issue: {
              id: 'issue-1',
              sessionId: 'session-1',
              timestamp: 1,
              lastSeenAt: 1,
              category: 'console-error',
              message: 'Oops',
              url: 'https://example.com/',
              occurrenceCount: 1,
              disposition: 'expected',
            },
          },
          {
            kind: 'action',
            timestamp: 2,
            action: {
              id: 'action-1',
              type: 'click',
              sessionId: 'session-1',
              timestamp: 2,
              url: 'https://example.com/',
              element: { tagName: 'button', semanticType: 'button' },
            },
          },
        ]}
        onIssueDispositionChange={onChange}
      />,
    );

    expect(
      screen.getByLabelText(/Issue classification: Expected/),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByRole('radiogroup', { name: /action/i })).toBeNull();

    const excluded = screen.getByRole('radio', {
      name: 'Mark console issue as Excluded',
    });
    await user.click(excluded);
    expect(onChange).toHaveBeenCalledWith({
      category: 'console',
      issueId: 'issue-1',
      disposition: 'excluded',
    });
    expect(
      screen.getByRole('radio', {
        name: 'Mark console issue as Expected',
      }),
    ).toHaveAttribute('aria-checked', 'true');
  });
});
