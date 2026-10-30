import { act, renderHook, waitFor } from '@testing-library/react';
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

  it('opens the prompt for one bug and returns to summary', async () => {
    const { result, rerender } = renderHook(
      ({ status, loading }: { status: SessionStatus; loading: boolean }) =>
        useSidePanelView(status, loading),
      { initialProps: { status: 'stopped' as SessionStatus, loading: false } },
    );
    await waitFor(() => {
      expect(result.current.view).toBe('summary');
    });

    act(() => {
      result.current.openPrompt('bug-2');
    });
    expect(result.current.view).toBe('prompt');
    expect(result.current.promptBugId).toBe('bug-2');

    rerender({ status: 'stopped', loading: true });
    rerender({ status: 'stopped', loading: false });
    expect(result.current.view).toBe('prompt');

    act(() => {
      result.current.backToSummary();
    });
    expect(result.current.view).toBe('summary');

    act(() => {
      result.current.openPrompt('bug-2');
    });
    rerender({ status: 'recording', loading: false });
    await waitFor(() => {
      expect(result.current.view).toBe('capture');
    });
  });
});
