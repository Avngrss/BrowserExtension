/// <reference types="chrome-types" />

import { expect, test } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  expectCapturingThisTab,
  launchExtension,
  openSidePanelPage,
  startRecordingOnPage,
  stopFromCapture,
  waitForCollectorsReady,
} from '../helpers/extension-playwright';
import { startDiagnosticsServer } from '../helpers/diagnostics-server';
import { SCREENSHOT_GROUPING_WINDOW_MS } from '../../src/screenshots/screenshot-capture-queue';

test('burst screenshots survive IndexedDB migration and appear in Summary', async () => {
  test.setTimeout(120_000);
  const { baseUrl, server } = await startDiagnosticsServer();
  const launched = await launchExtension();

  const serviceWorker =
    launched.context.serviceWorkers()[0] ??
    (await launched.context.waitForEvent('serviceworker'));
  const swErrors: string[] = [];
  serviceWorker.on('console', (message) => {
    if (message.type() === 'error') {
      swErrors.push(message.text());
    }
  });

  try {
    const page = await launched.context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.bringToFront();

    const sidePanel = await openSidePanelPage(
      launched.context,
      launched.extensionId,
    );

    await startRecordingOnPage(launched.context, launched.extensionId, page);
    await expectCapturingThisTab(sidePanel, page);
    await waitForCollectorsReady(launched.context, launched.extensionId, page);

    await page.bringToFront();
    await page.evaluate(() => {
      document.getElementById('ui-issue')?.click();
      document.getElementById('console-error')?.click();
      document.getElementById('ui-issue')?.click();
      document.getElementById('console-error')?.click();
    });
    await page.waitForTimeout(SCREENSHOT_GROUPING_WINDOW_MS + 800);

    await stopFromCapture(sidePanel, page);

    await expect
      .poll(
        async () => {
          const counts = await sidePanel
            .getByRole('article')
            .getByText(/^\d+ screenshots?$/)
            .allTextContents();
          return counts.reduce(
            (total, text) => total + Number.parseInt(text, 10),
            0,
          );
        },
        { timeout: 45_000, intervals: [500] },
      )
      .toBeGreaterThanOrEqual(1);

    await page.bringToFront();
    await sidePanel
      .getByRole('button', { name: 'Review', exact: true })
      .first()
      .evaluate((element) => {
        (element as HTMLElement).click();
      });
    await expect(
      sidePanel.getByRole('heading', { name: 'Issue Review' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      sidePanel
        .getByRole('img', { name: 'Issue screenshot thumbnail' })
        .first(),
    ).toBeVisible({ timeout: 20_000 });

    expect(swErrors.some((line) => line.includes('InvalidStateError'))).toBe(
      false,
    );
    expect(
      swErrors.some((line) =>
        line.includes("Failed to execute 'continue' on 'IDBCursor'"),
      ),
    ).toBe(false);
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
