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

test('burst screenshots do not block Stop and Session Summary', async () => {
  test.setTimeout(120_000);
  const { baseUrl, server } = await startDiagnosticsServer();
  const launched = await launchExtension();

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
    await page.waitForTimeout(SCREENSHOT_GROUPING_WINDOW_MS + 300);

    await stopFromCapture(sidePanel, page);

    await expect(
      sidePanel.getByText('The session could not be saved. Try again.'),
    ).toHaveCount(0);
    await expect(
      sidePanel.getByRole('heading', { name: /potential bugs? captured/ }),
    ).toBeVisible();

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
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
