import { logDev } from '@/src/utils/dev-log';
import { browser } from 'wxt/browser';

const INVALIDATED_MARKERS = [
  'Extension context invalidated',
  'context invalidated',
] as const;

export function isExtensionContextInvalidatedError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return INVALIDATED_MARKERS.some((marker) => message.includes(marker));
}

export function isExtensionContextValid(): boolean {
  try {
    void browser.runtime.id;
    return true;
  } catch {
    return false;
  }
}

export class ExtensionContextGuard {
  private disposed = false;
  private disposeCallbacks: Array<() => void> = [];

  registerDispose(callback: () => void): void {
    if (this.disposed) {
      return;
    }
    this.disposeCallbacks.push(callback);
  }

  assertUsable(): boolean {
    if (this.disposed) {
      return false;
    }
    if (!isExtensionContextValid()) {
      this.dispose('invalid-runtime-id');
      return false;
    }
    return true;
  }

  handleRuntimeFailure(error: unknown): void {
    if (this.disposed) {
      return;
    }
    if (
      isExtensionContextInvalidatedError(error) ||
      !isExtensionContextValid()
    ) {
      this.dispose('runtime-failure');
    }
  }

  sendRuntimeMessage<T extends Record<string, unknown>>(
    message: T,
  ): Promise<unknown> {
    if (!this.assertUsable()) {
      return Promise.reject(new Error('Extension context disposed.'));
    }
    return browser.runtime.sendMessage(message).catch((error: unknown) => {
      this.handleRuntimeFailure(error);
      throw error;
    });
  }

  dispose(reason: string): void {
    void reason;
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const callback of this.disposeCallbacks.splice(0)) {
      try {
        callback();
      } catch {
        // Ignore errors while tearing down an invalidated instance.
      }
    }
    if (import.meta.env.DEV) {
      logDev('Content script disposed: extension context invalidated');
    }
  }

  isDisposed(): boolean {
    return this.disposed;
  }
}
