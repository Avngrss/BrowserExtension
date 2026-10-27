import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputDebounceTracker } from '@/src/capture/input-debounce-tracker';

describe('input debounce tracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not flush when no pending input exists', () => {
    const tracker = new InputDebounceTracker();
    const element = document.createElement('input');
    const onFire = vi.fn();

    tracker.flush(element, onFire);
    expect(onFire).not.toHaveBeenCalled();
  });

  it('cancels pending timers without firing', () => {
    const tracker = new InputDebounceTracker();
    const element = document.createElement('input');
    const onFire = vi.fn();

    tracker.schedule(element, onFire);
    tracker.cancelAll();
    vi.advanceTimersByTime(500);
    expect(onFire).not.toHaveBeenCalled();
  });
});
