import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSOLE_BRIDGE_MESSAGE } from '@/src/capture/console-bridge-constants';
import {
  installMainWorldNetworkMonitoring,
  teardownMainWorldNetworkMonitoringForTests,
} from '@/src/capture/console-main-world-network';
import {
  installMainWorldConsoleBridge,
  setMainWorldBridgeActiveForTests,
  teardownMainWorldConsoleBridgeForTests,
} from '@/src/capture/console-main-world-bridge';

describe('MAIN-world network monitoring', () => {
  beforeEach(() => {
    teardownMainWorldConsoleBridgeForTests();
    teardownMainWorldNetworkMonitoringForTests();
  });

  afterEach(() => {
    teardownMainWorldConsoleBridgeForTests();
    teardownMainWorldNetworkMonitoringForTests();
  });

  it('captures fetch 4xx/5xx and ignores successful responses', async () => {
    const originalFetch = window.fetch.bind(window);
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', { status: 404, statusText: 'Not Found' }),
      )
      .mockResolvedValueOnce(
        new Response('', { status: 200, statusText: 'OK' }),
      );
    window.fetch = fetchSpy as typeof fetch;

    const emitted: unknown[] = [];
    installMainWorldNetworkMonitoring({
      isActive: () => true,
      emit: (payload) => {
        emitted.push(payload);
      },
    });

    await window.fetch('https://example.com/missing');
    await window.fetch('https://example.com/ok');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      source: 'fetch',
      category: 'http-error',
      status: 404,
    });

    window.fetch = originalFetch;
  });

  it('rethrows rejected fetch and captures a network failure', async () => {
    const rejection = new TypeError('Failed to fetch');
    const fetchSpy = vi.fn().mockRejectedValueOnce(rejection);
    window.fetch = fetchSpy as typeof fetch;

    const emitted: unknown[] = [];
    installMainWorldNetworkMonitoring({
      isActive: () => true,
      emit: (payload) => {
        emitted.push(payload);
      },
    });

    await expect(window.fetch('https://example.com/broken')).rejects.toBe(
      rejection,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(emitted[0]).toMatchObject({
      source: 'fetch',
      category: 'network-failure',
    });
  });

  it('captures xhr http errors and ignores success', () => {
    const emitted: unknown[] = [];
    installMainWorldNetworkMonitoring({
      isActive: () => true,
      emit: (payload) => {
        emitted.push(payload);
      },
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://example.com/api/orders');
    xhr.send();
    Object.defineProperty(xhr, 'status', { value: 500, configurable: true });
    Object.defineProperty(xhr, 'statusText', {
      value: 'Server Error',
      configurable: true,
    });
    xhr.dispatchEvent(new Event('load'));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      source: 'xhr',
      category: 'http-error',
      method: 'POST',
      status: 500,
    });
  });

  it('installs only once through the console bridge bootstrap', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 404 }));
    window.fetch = fetchSpy as typeof fetch;

    installMainWorldConsoleBridge();
    setMainWorldBridgeActiveForTests(true);

    await window.fetch('https://example.com/nope');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not capture when bridge is inactive at completion time', async () => {
    let active = true;
    const fetchSpy = vi.fn().mockImplementation(() => {
      active = false;
      return Promise.resolve(new Response('', { status: 500 }));
    });
    window.fetch = fetchSpy as typeof fetch;

    const emitted: unknown[] = [];
    installMainWorldNetworkMonitoring({
      isActive: () => active,
      emit: (payload) => {
        emitted.push(payload);
      },
    });

    await window.fetch('https://example.com/late-stop');
    expect(emitted).toHaveLength(0);
  });

  it('posts network issues through the shared bridge channel', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 404 }));
    window.fetch = fetchSpy as typeof fetch;

    installMainWorldConsoleBridge();
    setMainWorldBridgeActiveForTests(true);

    const postMessageSpy = vi.spyOn(window, 'postMessage');
    await window.fetch('https://example.com/profile');

    expect(
      postMessageSpy.mock.calls.some(([payload]) => {
        const data = payload as Record<string, unknown>;
        return (
          data.type === CONSOLE_BRIDGE_MESSAGE.NETWORK_ISSUE &&
          data.category === 'http-error'
        );
      }),
    ).toBe(true);
    postMessageSpy.mockRestore();
  });
});
