import { describe, expect, it, vi } from 'vitest';
import {
  ExtensionContextGuard,
  isExtensionContextInvalidatedError,
} from '@/src/capture/extension-context-guard';

describe('extension context guard', () => {
  it('detects invalidated error text', () => {
    expect(
      isExtensionContextInvalidatedError(
        new Error('Extension context invalidated.'),
      ),
    ).toBe(true);
  });

  it('disposes once and runs cleanup callbacks', () => {
    const guard = new ExtensionContextGuard();
    const cleanup = vi.fn();
    guard.registerDispose(cleanup);
    guard.dispose('test');
    guard.dispose('test');
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(guard.isDisposed()).toBe(true);
  });
});
