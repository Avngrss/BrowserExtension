import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { StatusBadge } from '@/src/components/StatusBadge';
import { resetExtensionBrowserMock } from '../helpers/mock-extension-browser';

describe('StatusBadge', () => {
  beforeEach(() => {
    resetExtensionBrowserMock();
  });

  it('exposes the monitoring status and dark-theme styles', () => {
    render(
      <StrictMode>
        <StatusBadge label="Not monitoring" />
      </StrictMode>,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Not monitoring');
    expect(status.className).toContain('dark:text-slate-100');
    expect(status.className).toContain('text-slate-800');
  });
});
