/// <reference types="chrome-types" />

import { expect, test } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  clickSidePanelControl,
  expectCapturingThisTab,
  launchExtension,
  openSidePanelPage,
  startRecordingOnPage,
} from '../helpers/extension-playwright';
import { startDiagnosticsServer } from '../helpers/diagnostics-server';

test('start new capture after an automatic bug without page reload', async () => {
  test.setTimeout(180_000);
  const { baseUrl, server } = await startDiagnosticsServer();
  const launched = await launchExtension();

  try {
    const page = await launched.context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.bringToFront();

    await startRecordingOnPage(launched.context, launched.extensionId, page);

    const sidePanel = await openSidePanelPage(
      launched.context,
      launched.extensionId,
    );
    await expectCapturingThisTab(sidePanel, page);

    await page.click('#action-event');
    await page.click('#console-error');
    await page.waitForTimeout(400);

    await clickSidePanelControl(sidePanel, page, { name: 'Stop and review' });
    await expect(
      sidePanel.getByRole('heading', { name: 'Session Summary' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      sidePanel.getByLabel('Potential bugs', { exact: true }),
    ).toBeVisible();

    await clickSidePanelControl(sidePanel, page, {
      name: 'Start new capture',
    });
    await expect(
      sidePanel.getByText(
        'Starting a new capture will delete the current session data.',
      ),
    ).toBeVisible();
    await page.bringToFront();
    await sidePanel
      .getByRole('button', { name: 'Start new capture' })
      .last()
      .evaluate((element) => {
        (element as HTMLElement).click();
      });

    await expectCapturingThisTab(sidePanel, page);
    await expect(
      sidePanel.getByText('Capture could not start on this page.'),
    ).toHaveCount(0);

    await page.click('#action-event');

    await expect
      .poll(
        async () =>
          sidePanel.getByText('Recent activity').locator('..').textContent(),
        { timeout: 15_000 },
      )
      .toMatch(/click|action|Create action event/i);

    await expect(
      sidePanel.getByLabel('Potential bugs', { exact: true }),
    ).toHaveCount(0);
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
