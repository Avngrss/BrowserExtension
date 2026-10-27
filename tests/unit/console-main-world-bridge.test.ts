import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSOLE_BRIDGE_MESSAGE } from '@/src/capture/console-bridge-constants';
import {
  handleUncaughtRuntimeErrorForTests,
  installMainWorldConsoleBridge,
  setMainWorldBridgeActiveForTests,
  teardownMainWorldConsoleBridgeForTests,
} from '@/src/capture/console-main-world-bridge';

describe('MAIN-world console bridge', () => {
  beforeEach(() => {
    teardownMainWorldConsoleBridgeForTests();
  });

  afterEach(() => {
    teardownMainWorldConsoleBridgeForTests();
  });

  it('installs exactly once and announces bridge ready', () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    installMainWorldConsoleBridge();
    installMainWorldConsoleBridge();

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: CONSOLE_BRIDGE_MESSAGE.READY }),
      '*',
    );
    postMessageSpy.mockRestore();
  });

  it('calls the original console.error exactly once and captures issues when active', () => {
    const underlying = vi.fn();
    console.error = underlying as typeof console.error;

    installMainWorldConsoleBridge();
    setMainWorldBridgeActiveForTests(true);

    const postMessageSpy = vi.spyOn(window, 'postMessage');
    console.error('Bug Capture Assistant test error');

    expect(underlying).toHaveBeenCalledTimes(1);
    expect(underlying).toHaveBeenCalledWith('Bug Capture Assistant test error');
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CONSOLE_BRIDGE_MESSAGE.ISSUE,
        category: 'console-error',
      }),
      '*',
    );
    postMessageSpy.mockRestore();
  });

  it('ignores resource-loading errors and captures uncaught JavaScript errors', () => {
    installMainWorldConsoleBridge();
    setMainWorldBridgeActiveForTests(true);

    const postMessageSpy = vi.spyOn(window, 'postMessage');

    const resourceError = new Event('error', {
      bubbles: true,
    }) as ErrorEvent;
    Object.defineProperty(resourceError, 'target', {
      value: document.createElement('img'),
    });
    Object.defineProperty(resourceError, 'message', { value: 'Image failed' });
    window.dispatchEvent(resourceError);

    const uncaughtError = new ErrorEvent('error', {
      message: 'Bug Capture Assistant uncaught test',
    });
    Object.defineProperty(uncaughtError, 'error', {
      value: new Error('Bug Capture Assistant uncaught test'),
    });
    handleUncaughtRuntimeErrorForTests(uncaughtError);

    const uncaughtCalls = postMessageSpy.mock.calls.filter(([payload]) => {
      const data = payload as Record<string, unknown>;
      return (
        data.type === CONSOLE_BRIDGE_MESSAGE.ISSUE &&
        data.category === 'uncaught-error'
      );
    });
    expect(uncaughtCalls).toHaveLength(1);
    postMessageSpy.mockRestore();
  });

  it('normalizes unhandled rejections', () => {
    installMainWorldConsoleBridge();
    setMainWorldBridgeActiveForTests(true);

    const postMessageSpy = vi.spyOn(window, 'postMessage');
    const rejection = new Error('Bug Capture Assistant rejection test');
    const promise = Promise.reject(rejection);
    promise.catch(() => undefined);
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        promise,
        reason: rejection,
      }),
    );

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CONSOLE_BRIDGE_MESSAGE.ISSUE,
        category: 'unhandled-rejection',
      }),
      '*',
    );
    postMessageSpy.mockRestore();
  });

  it('dedupes a console.error that follows the same uncaught error', () => {
    installMainWorldConsoleBridge();
    setMainWorldBridgeActiveForTests(true);

    const postMessageSpy = vi.spyOn(window, 'postMessage');
    const error = new Error('Duplicate path');
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: error.message,
        error,
      }),
    );
    console.error(error);

    const issueCalls = postMessageSpy.mock.calls.filter(([payload]) => {
      const data = payload as Record<string, unknown>;
      return data.type === CONSOLE_BRIDGE_MESSAGE.ISSUE;
    });
    expect(issueCalls).toHaveLength(1);
    postMessageSpy.mockRestore();
  });

  it('does not capture issues while deactivated', () => {
    installMainWorldConsoleBridge();
    setMainWorldBridgeActiveForTests(false);

    const postMessageSpy = vi.spyOn(window, 'postMessage');
    console.error('ignored error');
    const issueCalls = postMessageSpy.mock.calls.filter(([payload]) => {
      const data = payload as Record<string, unknown>;
      return data.type === CONSOLE_BRIDGE_MESSAGE.ISSUE;
    });
    expect(issueCalls).toHaveLength(0);
    postMessageSpy.mockRestore();
  });
});
