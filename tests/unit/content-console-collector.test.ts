import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONSOLE_BRIDGE_CHANNEL,
  CONSOLE_BRIDGE_MESSAGE,
  CONSOLE_BRIDGE_SCHEMA_VERSION,
} from '@/src/capture/console-bridge-constants';
import { ContentConsoleCollector } from '@/src/capture/content-console-collector';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';

const recordingSession = {
  status: 'recording' as const,
  id: 'session-1',
  startedAt: 1_000,
  pausedAt: null,
  stoppedAt: null,
  ...DEFAULT_TEST_SESSION_TARGET,
};

function dispatchBridgeMessage(data: Record<string, unknown>): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      data,
      source: window,
    }),
  );
}

function readyMessage(): Record<string, unknown> {
  return {
    type: CONSOLE_BRIDGE_MESSAGE.READY,
    channel: CONSOLE_BRIDGE_CHANNEL,
    schemaVersion: CONSOLE_BRIDGE_SCHEMA_VERSION,
  };
}

function issueMessage(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: CONSOLE_BRIDGE_MESSAGE.ISSUE,
    channel: CONSOLE_BRIDGE_CHANNEL,
    schemaVersion: CONSOLE_BRIDGE_SCHEMA_VERSION,
    category: 'console-error',
    parts: ['Failed to load user profile'],
    ...overrides,
  };
}

function createCollector() {
  const submitIssue = vi.fn().mockResolvedValue({ ok: true, issues: [] });
  const collector = new ContentConsoleCollector({
    getLocation: () => ({ href: 'https://example.com/checkout' }) as Location,
    submitIssue,
  });
  collector.setTabId(DEFAULT_TEST_SESSION_TARGET.targetTabId);
  collector.updateSession(recordingSession);
  submitIssue.mockClear();
  return { collector, submitIssue };
}

describe('content console collector handshake', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('activates after bridge ready when monitoring already started', () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    createCollector();
    dispatchBridgeMessage(readyMessage());

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CONSOLE_BRIDGE_MESSAGE.ACTIVATE,
        channel: CONSOLE_BRIDGE_CHANNEL,
        schemaVersion: CONSOLE_BRIDGE_SCHEMA_VERSION,
      }),
      '*',
    );
    postMessageSpy.mockRestore();
  });

  it('activates when monitoring starts after bridge ready', () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    const { collector } = createCollector();
    dispatchBridgeMessage(readyMessage());
    postMessageSpy.mockClear();

    collector.updateSession({ status: 'idle' });
    collector.setTabId(DEFAULT_TEST_SESSION_TARGET.targetTabId);
    collector.updateSession(recordingSession);

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: CONSOLE_BRIDGE_MESSAGE.ACTIVATE }),
      '*',
    );
    postMessageSpy.mockRestore();
  });

  it('handles duplicate ready and activate messages idempotently', () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    createCollector();
    dispatchBridgeMessage(readyMessage());
    dispatchBridgeMessage(readyMessage());
    dispatchBridgeMessage(readyMessage());
    expect(postMessageSpy).toHaveBeenCalled();
    postMessageSpy.mockRestore();
  });

  it('captures validated bridge issues while recording', () => {
    const { submitIssue } = createCollector();
    dispatchBridgeMessage(readyMessage());
    dispatchBridgeMessage(issueMessage());

    expect(submitIssue).toHaveBeenCalledTimes(1);
    expect(submitIssue.mock.calls[0]?.[0]).toMatchObject({
      category: 'console-error',
      message: 'Failed to load user profile',
      url: 'https://example.com/checkout',
    });
  });

  it('rejects malformed and untrusted messages', () => {
    const { submitIssue } = createCollector();
    dispatchBridgeMessage(readyMessage());
    dispatchBridgeMessage({
      type: CONSOLE_BRIDGE_MESSAGE.ISSUE,
      channel: 'wrong',
    });
    dispatchBridgeMessage(
      issueMessage({
        parts: [],
      }),
    );
    expect(submitIssue).not.toHaveBeenCalled();
  });

  it('deactivates on pause, stop, and idle', () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    const { collector, submitIssue } = createCollector();
    dispatchBridgeMessage(readyMessage());
    postMessageSpy.mockClear();

    collector.updateSession({
      ...recordingSession,
      status: 'paused',
      pausedAt: 2_000,
      stoppedAt: null,
    });
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: CONSOLE_BRIDGE_MESSAGE.DEACTIVATE }),
      '*',
    );

    dispatchBridgeMessage(issueMessage());
    expect(submitIssue).not.toHaveBeenCalled();
    postMessageSpy.mockRestore();
  });

  it('removed the obsolete inline bridge injection module', () => {
    expect(existsSync(resolve('src/capture/console-page-bridge.ts'))).toBe(
      false,
    );
    expect(existsSync(resolve('entrypoints/console-bridge.content.ts'))).toBe(
      false,
    );
  });
});
