import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/src/components/Button';

describe('Button', () => {
  it('exposes danger styling and focus styles for destructive actions', () => {
    render(
      <StrictMode>
        <Button variant="danger">Delete session</Button>
      </StrictMode>,
    );

    const button = screen.getByRole('button', { name: 'Delete session' });
    expect(button).toHaveAttribute('data-variant', 'danger');
    expect(button.className).toContain('border-red-800');
    expect(button.className).toContain('focus-visible:outline-2');

    button.focus();
    expect(button).toHaveFocus();
  });

  it('keeps primary and secondary variants distinct from danger', () => {
    render(
      <StrictMode>
        <Button variant="primary">Start new capture</Button>
        <Button variant="secondary">Keep current session</Button>
      </StrictMode>,
    );

    expect(
      screen.getByRole('button', { name: 'Start new capture' }),
    ).toHaveAttribute('data-variant', 'primary');
    expect(
      screen.getByRole('button', { name: 'Keep current session' }),
    ).toHaveAttribute('data-variant', 'secondary');
  });
});
