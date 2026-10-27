import { describe, expect, it, vi } from 'vitest';
import { ContentActionCollector } from '@/src/capture/content-action-collector';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';

const recordingSession = {
  status: 'recording' as const,
  id: 'session-1',
  startedAt: 1_000,
  pausedAt: null,
  stoppedAt: null,
  ...DEFAULT_TEST_SESSION_TARGET,
};

describe('content action collector', () => {
  it('captures clicks only while recording on the target tab', () => {
    const submitAction = vi.fn();
    const collector = new ContentActionCollector({
      getLocation: () => ({ href: 'https://example.com/page' }) as Location,
      getDocumentTitle: () => 'Example',
      submitAction,
    });

    collector.setTabId(DEFAULT_TEST_SESSION_TARGET.targetTabId);
    collector.updateSession(recordingSession);

    const button = document.createElement('button');
    button.textContent = 'Save';
    document.body.appendChild(button);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(submitAction).toHaveBeenCalledTimes(2);

    collector.updateSession({
      ...recordingSession,
      status: 'paused',
      pausedAt: 1_500,
      stoppedAt: null,
    });
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(submitAction).toHaveBeenCalledTimes(2);
    document.body.removeChild(button);
  });

  it('does not duplicate listeners after repeated recording updates', () => {
    const submitAction = vi.fn();
    const addSpy = vi.spyOn(document, 'addEventListener');
    const collector = new ContentActionCollector({
      getLocation: () => ({ href: 'https://example.com/page' }) as Location,
      getDocumentTitle: () => 'Example',
      submitAction,
    });
    collector.setTabId(DEFAULT_TEST_SESSION_TARGET.targetTabId);
    collector.updateSession(recordingSession);
    collector.updateSession(recordingSession);
    const clickAdds = addSpy.mock.calls.filter(([type]) => type === 'click');
    expect(clickAdds).toHaveLength(1);
    addSpy.mockRestore();
  });

  it('ignores collection from non-target tabs', () => {
    const submitAction = vi.fn();
    const collector = new ContentActionCollector({
      getLocation: () => ({ href: 'https://example.com/page' }) as Location,
      getDocumentTitle: () => 'Example',
      submitAction,
    });
    collector.setTabId(99);
    collector.updateSession(recordingSession);

    const button = document.createElement('button');
    document.body.appendChild(button);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(submitAction).not.toHaveBeenCalled();
    document.body.removeChild(button);
  });
});
