import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionTimeline } from '@/src/components/ActionTimeline';

describe('ActionTimeline', () => {
  it('shows compact readable cards without technical metadata', () => {
    render(
      <ActionTimeline
        actions={[
          {
            id: 'action-1',
            type: 'click',
            sessionId: 'session-1',
            timestamp: new Date('2026-01-01T12:00:00Z').getTime(),
            url: 'https://example.com/test_cases',
            element: {
              tagName: 'a',
              semanticType: 'link',
              accessibleName: 'Test Cases',
              testId: 'nav-cases',
              role: 'link',
            },
          },
          {
            id: 'action-2',
            type: 'input',
            sessionId: 'session-1',
            timestamp: new Date('2026-01-01T12:00:01Z').getTime(),
            url: 'https://example.com/signup',
            redacted: true,
            element: {
              tagName: 'input',
              semanticType: 'textbox',
              inputType: 'password',
              testId: 'password-field',
            },
          },
        ]}
      />,
    );

    expect(
      screen.getByText(/Clicked link “Test Cases” · \/test_cases/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Entered value into textbox · Sensitive value hidden · \/signup/,
      ),
    ).toBeInTheDocument();

    expect(screen.queryByText(/^click$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/testId=/)).not.toBeInTheDocument();
    expect(screen.queryByText(/type=password/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/https:\/\/example\.com/),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders descriptions as plain text without HTML injection', () => {
    render(
      <ActionTimeline
        actions={[
          {
            id: 'action-x',
            type: 'click',
            sessionId: 'session-1',
            timestamp: 1,
            url: 'https://example.com/',
            element: {
              tagName: 'button',
              semanticType: 'button',
              accessibleName: '<img onerror=alert(1)>',
            },
          },
        ]}
      />,
    );

    expect(
      screen.getByText(/Clicked button “<img onerror=alert\(1\)>” · \//),
    ).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});
