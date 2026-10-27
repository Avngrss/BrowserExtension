import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentActionCollector } from '@/src/capture/content-action-collector';
import { INPUT_DEBOUNCE_MS } from '@/src/capture/input-debounce-tracker';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';

const recordingSession = {
  status: 'recording' as const,
  id: 'session-1',
  startedAt: 1_000,
  pausedAt: null,
  stoppedAt: null,
  ...DEFAULT_TEST_SESSION_TARGET,
};

function createCollector() {
  const submitAction = vi.fn();
  const collector = new ContentActionCollector({
    getLocation: () => ({ href: 'https://example.com/form' }) as Location,
    getDocumentTitle: () => 'Form',
    submitAction,
  });
  collector.setTabId(DEFAULT_TEST_SESSION_TARGET.targetTabId);
  collector.updateSession(recordingSession);
  submitAction.mockClear();
  return { collector, submitAction };
}

describe('field input and change collector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('debounces text input and emits one completed input action', () => {
    const { submitAction } = createCollector();
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('aria-label', 'Email');
    document.body.appendChild(input);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(submitAction).not.toHaveBeenCalled();

    vi.advanceTimersByTime(INPUT_DEBOUNCE_MS);
    expect(submitAction).toHaveBeenCalledTimes(1);
    expect(submitAction.mock.calls[0]?.[0]).toMatchObject({
      type: 'input',
      element: { semanticType: 'textbox', accessibleName: 'Email' },
    });
    expect(submitAction.mock.calls[0]?.[0]).not.toHaveProperty('value');
  });

  it('flushes pending input on blur without duplicating debounced emit', () => {
    const { submitAction } = createCollector();
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('aria-label', 'Email');
    document.body.appendChild(input);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    expect(submitAction).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(INPUT_DEBOUNCE_MS);
    expect(submitAction).toHaveBeenCalledTimes(1);
  });

  it('cancels pending timers when recording stops or becomes idle', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    const { collector, submitAction } = createCollector();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    collector.updateSession({
      ...recordingSession,
      status: 'stopped',
      stoppedAt: 2_000,
    });
    vi.advanceTimersByTime(INPUT_DEBOUNCE_MS);
    expect(submitAction).not.toHaveBeenCalled();

    submitAction.mockClear();
    collector.updateSession(recordingSession);
    submitAction.mockClear();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    collector.updateSession({ status: 'idle' });
    vi.advanceTimersByTime(INPUT_DEBOUNCE_MS);
    expect(submitAction).not.toHaveBeenCalled();
  });

  it('cancels pending timers when recording pauses', () => {
    const { collector, submitAction } = createCollector();
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    collector.updateSession({
      ...recordingSession,
      status: 'paused',
      pausedAt: 2_000,
      stoppedAt: null,
    });
    vi.advanceTimersByTime(INPUT_DEBOUNCE_MS);
    expect(submitAction).not.toHaveBeenCalled();
  });

  it('captures radio change with checked state only', () => {
    const { submitAction } = createCollector();
    const input = document.createElement('input');
    input.type = 'radio';
    input.setAttribute('aria-label', 'Delivery method');
    input.checked = true;
    document.body.appendChild(input);

    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(submitAction.mock.calls[0]?.[0]).toMatchObject({
      type: 'change',
      checked: true,
      element: { semanticType: 'radio' },
    });
    expect(submitAction.mock.calls[0]?.[0]).not.toHaveProperty('value');
  });

  it('marks data-private fields as redacted', () => {
    const { submitAction } = createCollector();
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('data-private', '');
    input.setAttribute('aria-label', 'Secret');
    document.body.appendChild(input);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(INPUT_DEBOUNCE_MS);
    expect(submitAction.mock.calls[0]?.[0]).toMatchObject({
      type: 'input',
      redacted: true,
    });
  });

  it('captures checkbox change with checked state only', () => {
    const { submitAction } = createCollector();
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('aria-label', 'Subscribe');
    input.checked = true;
    document.body.appendChild(input);

    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(submitAction).toHaveBeenCalledTimes(1);
    expect(submitAction.mock.calls[0]?.[0]).toMatchObject({
      type: 'change',
      checked: true,
      element: { semanticType: 'checkbox', accessibleName: 'Subscribe' },
    });
    expect(submitAction.mock.calls[0]?.[0]).not.toHaveProperty('value');
  });

  it('marks password fields as redacted without storing values', () => {
    const { submitAction } = createCollector();
    const input = document.createElement('input');
    input.type = 'password';
    input.setAttribute('aria-label', 'Password');
    document.body.appendChild(input);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(INPUT_DEBOUNCE_MS);
    const payload = submitAction.mock.calls[0]?.[0] as {
      element?: Record<string, unknown>;
    };
    expect(payload).toMatchObject({
      type: 'input',
      redacted: true,
    });
    expect(payload.element).not.toHaveProperty('accessibleName');
  });

  it('resumes input collection after pause without duplicate actions', () => {
    const { collector, submitAction } = createCollector();
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('aria-label', 'Name');
    document.body.appendChild(input);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(INPUT_DEBOUNCE_MS);
    expect(submitAction).toHaveBeenCalledTimes(1);

    collector.updateSession({
      ...recordingSession,
      status: 'paused',
      pausedAt: 2_000,
      stoppedAt: null,
    });
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(INPUT_DEBOUNCE_MS);
    expect(submitAction).toHaveBeenCalledTimes(1);

    collector.updateSession(recordingSession);
    submitAction.mockClear();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(INPUT_DEBOUNCE_MS);
    expect(submitAction).toHaveBeenCalledTimes(1);
  });

  it('captures select change without option values', () => {
    const { submitAction } = createCollector();
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Country');
    const option = document.createElement('option');
    option.value = 'us';
    option.textContent = 'United States';
    select.appendChild(option);
    select.value = 'us';
    document.body.appendChild(select);

    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(submitAction).toHaveBeenCalledTimes(1);
    expect(submitAction.mock.calls[0]?.[0]).toMatchObject({ type: 'change' });
    expect(JSON.stringify(submitAction.mock.calls[0]?.[0])).not.toContain('us');
  });

  it('captures file input change without file metadata', () => {
    const { submitAction } = createCollector();
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('aria-label', 'Attachment');
    document.body.appendChild(input);

    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(submitAction.mock.calls[0]?.[0]).toMatchObject({ type: 'change' });
    const payload = submitAction.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('value');
    expect(payload).not.toHaveProperty('files');
  });

  it('ignores disabled fields', () => {
    const { submitAction } = createCollector();
    const input = document.createElement('input');
    input.type = 'text';
    input.disabled = true;
    document.body.appendChild(input);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(INPUT_DEBOUNCE_MS);
    expect(submitAction).not.toHaveBeenCalled();
  });
});
