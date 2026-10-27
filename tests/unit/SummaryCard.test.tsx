import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SummaryCard } from '@/src/components/SummaryCard';
import { resetExtensionBrowserMock } from '../helpers/mock-extension-browser';

describe('SummaryCard', () => {
  beforeEach(() => {
    resetExtensionBrowserMock();
  });

  it('shows the collector name and a zero count', () => {
    render(
      <StrictMode>
        <SummaryCard label="Network" value={0} />
      </StrictMode>,
    );

    expect(
      screen.getByRole('heading', { name: 'Network' }),
    ).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Network issue disposition breakdown'),
    ).not.toBeInTheDocument();

    const card = screen.getByRole('article');
    expect(card.className).toContain('dark:bg-slate-900');
    expect(card.className).toContain('border-slate-200');
    expect(card.className).toContain('shadow-sm');
  });

  it('shows disposition breakdown lines for issue cards', () => {
    render(
      <StrictMode>
        <SummaryCard
          label="Console"
          value={2}
          dispositionBreakdown={{
            unexpected: 1,
            expected: 1,
            excluded: 0,
          }}
        />
      </StrictMode>,
    );

    const breakdown = screen.getByLabelText(
      'Console issue disposition breakdown',
    );
    expect(breakdown).toHaveTextContent('Unexpected: 1');
    expect(breakdown).toHaveTextContent('Expected: 1');
    expect(breakdown).not.toHaveTextContent('Excluded:');
  });
});
