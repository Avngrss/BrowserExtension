import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiIssueDetector } from '@/src/capture/ui-issue-detector';
import type { UiIssueRule } from '@/src/domain/ui-rule';

const alertRule: UiIssueRule = {
  id: 'rule-alert',
  name: 'Alert role',
  selector: '[role="alert"]',
  severity: 'error',
  enabled: true,
};

function markLayoutVisible(element: Element): void {
  Object.defineProperty(element, 'getClientRects', {
    configurable: true,
    value: () =>
      [
        {
          x: 0,
          y: 0,
          width: 120,
          height: 24,
          top: 0,
          left: 0,
          right: 120,
          bottom: 24,
        },
      ] as unknown as DOMRectList,
  });
}

async function flushDomUpdates(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('UiIssueDetector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('detects visible matches during the initial scan', () => {
    const onDetection = vi.fn();
    const detector = new UiIssueDetector({
      root: document,
      onDetection,
    });
    detector.setRules([alertRule]);

    const alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.textContent = 'Email is required';
    markLayoutVisible(alert);
    document.body.appendChild(alert);

    detector.runInitialScan();

    expect(onDetection).toHaveBeenCalledTimes(1);
    expect(onDetection.mock.calls[0]?.[0]).toMatchObject({
      visibleMessage: 'Email is required',
    });
  });

  it('ignores invisible matches', () => {
    const onDetection = vi.fn();
    const detector = new UiIssueDetector({
      root: document,
      onDetection,
    });
    detector.setRules([alertRule]);

    const alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.textContent = 'Hidden error';
    markLayoutVisible(alert);
    alert.style.display = 'none';
    document.body.appendChild(alert);

    detector.runInitialScan();
    expect(onDetection).not.toHaveBeenCalled();
  });

  it('does not repeat unchanged detections on unrelated mutations', async () => {
    const onDetection = vi.fn();
    const detector = new UiIssueDetector({
      root: document,
      onDetection,
    });
    detector.setRules([alertRule]);
    detector.start();

    const alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.textContent = 'Email is required';
    markLayoutVisible(alert);
    document.body.appendChild(alert);

    const unrelated = document.createElement('div');
    unrelated.textContent = 'Unrelated';
    document.body.appendChild(unrelated);

    await flushDomUpdates();
    expect(onDetection).toHaveBeenCalledTimes(1);
    detector.stop();
  });

  it('reports again after an element is removed and re-added', async () => {
    const onDetection = vi.fn();
    const detector = new UiIssueDetector({
      root: document,
      onDetection,
    });
    detector.setRules([alertRule]);
    detector.start();

    const alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.textContent = 'Email is required';
    markLayoutVisible(alert);
    document.body.appendChild(alert);
    alert.remove();
    document.body.appendChild(alert);

    await flushDomUpdates();
    expect(onDetection).toHaveBeenCalledTimes(2);
    detector.stop();
  });

  it('omits visible message text inside private containers', () => {
    const onDetection = vi.fn();
    const detector = new UiIssueDetector({
      root: document,
      onDetection,
    });
    detector.setRules([alertRule]);

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-private', '');
    const alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.textContent = 'Secret OTP code';
    markLayoutVisible(alert);
    wrapper.appendChild(alert);
    document.body.appendChild(wrapper);

    detector.runInitialScan();
    expect(onDetection).toHaveBeenCalledTimes(1);
    const firstDetection = onDetection.mock.calls[0]?.[0] as {
      visibleMessage?: string;
    };
    expect(firstDetection.visibleMessage).toBeUndefined();
  });
});
