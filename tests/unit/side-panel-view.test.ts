import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SessionStatus } from '@/src/domain/session';
import { useSidePanelView } from '@/src/hooks/useSidePanelView';

describe('useSidePanelView', () => {
  it('opens summary when a stopped session loads', async () => {
    const { result, rerender } = renderHook(
      ({ status, loading }: { status: SessionStatus; loading: boolean }) =>
        useSidePanelView(status, loading),
      { initialProps: { status: 'idle' as SessionStatus, loading: true } },
    );

    expect(result.current.view).toBe('capture');

    rerender({ status: 'stopped', loading: false });

    await waitFor(() => {
      expect(result.current.view).toBe('summary');
    });
  });
});
