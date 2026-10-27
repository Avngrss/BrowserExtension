/// <reference types="chrome-types" />

import { expect, test, type BrowserContext } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  launchExtension,
} from '../helpers/extension-playwright';
import { startDiagnosticsServer } from '../helpers/diagnostics-server';
import { SCREENSHOT_GROUPING_WINDOW_MS } from '../../src/screenshots/screenshot-capture-queue';

async function sendExtensionMessageEphemeral(
  context: BrowserContext,
  extensionId: string,
  message: Record<string, unknown>,
): Promise<unknown> {
  const bridge = await context.newPage();
  try {
    await bridge.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: 'domcontentloaded',
    });
    return await bridge.evaluate(
      (payload: Record<string, unknown>) =>
        chrome.runtime.sendMessage(payload) as unknown,
      message,
    );
  } finally {
    await bridge.close();
  }
}

type ScreenshotRecord = {
  frameId?: string;
  id: string;
  issueCategory: string;
  issueId: string;
  status: string;
  linkedIssueCount?: number;
};

async function readScreenshotEvidence(
  context: BrowserContext,
  extensionId: string,
  refocusPage?: import('@playwright/test').Page,
): Promise<ScreenshotRecord[]> {
  const response: unknown = await sendExtensionMessageEphemeral(
    context,
    extensionId,
    { type: 'GET_SCREENSHOT_EVIDENCE_LIST' },
  );
  if (refocusPage !== undefined) {
    await refocusPage.bringToFront();
  }
  if (
    typeof response !== 'object' ||
    response === null ||
    !('evidence' in response) ||
    !Array.isArray((response as { evidence: unknown[] }).evidence)
  ) {
    return [];
  }
  return (response as { evidence: ScreenshotRecord[] }).evidence;
}

function uniqueCapturedFrameIds(records: ScreenshotRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const record of records) {
    if (record.status === 'captured') {
      ids.add(record.frameId ?? record.id);
    }
  }
  return ids;
}

test('burst screenshot evidence shares frames and finishes after stop', async () => {
  test.setTimeout(120_000);
  const { baseUrl, server } = await startDiagnosticsServer();
  const launched = await launchExtension();

  try {
    const page = await launched.context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.bringToFront();

    await sendExtensionMessageEphemeral(
      launched.context,
      launched.extensionId,
      { type: 'START_SESSION' },
    );
    await page.bringToFront();
    await page.waitForTimeout(1_500);

    await page.evaluate(() => {
      document.getElementById('ui-issue')?.click();
      document.getElementById('console-error')?.click();
      document.getElementById('fetch-404')?.click();
    });
    await page.waitForTimeout(SCREENSHOT_GROUPING_WINDOW_MS + 200);

    await sendExtensionMessageEphemeral(
      launched.context,
      launched.extensionId,
      { type: 'STOP_SESSION' },
    );
    await page.bringToFront();

    await expect
      .poll(
        async () => {
          const records = await readScreenshotEvidence(
            launched.context,
            launched.extensionId,
            page,
          );
          const captured = records.filter((item) => item.status === 'captured');
          const pending = records.filter(
            (item) => item.status === 'queued' || item.status === 'pending',
          );
          return { captured: captured.length, pending: pending.length };
        },
        { timeout: 45_000, intervals: [1_000] },
      )
      .toMatchObject({ captured: 1, pending: 0 });

    const finalRecords = await readScreenshotEvidence(
      launched.context,
      launched.extensionId,
      page,
    );
    expect(
      finalRecords.filter((item) => item.status === 'failed'),
    ).toHaveLength(0);
    const frameIds = uniqueCapturedFrameIds(finalRecords);
    expect(frameIds.size).toBeGreaterThanOrEqual(1);
    expect(frameIds.size).toBeLessThanOrEqual(1);

    const sidePanel = await launched.context.newPage();
    await sidePanel.goto(
      `chrome-extension://${launched.extensionId}/sidepanel.html`,
    );
    await sidePanel
      .getByRole('button', { name: 'Review', exact: true })
      .first()
      .click();
    await expect(
      sidePanel
        .getByRole('img', { name: 'Issue screenshot thumbnail' })
        .first(),
    ).toBeVisible({ timeout: 20_000 });
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
