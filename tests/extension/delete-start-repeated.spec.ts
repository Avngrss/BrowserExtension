/// <reference types="chrome-types" />

import { expect, test } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  clickSidePanelControl,
  deleteSessionFromSummary,
  expectCapturingThisTab,
  expectOneNewActionAfterClick,
  launchExtension,
  openSidePanelPage,
  startRecordingOnPage,
  stopFromCapture,
} from '../helpers/extension-playwright';
import { startDiagnosticsServer } from '../helpers/diagnostics-server';

async function captureActivityBeforeStop(
  sidePanel: Parameters<typeof clickSidePanelControl>[0],
  page: Parameters<typeof clickSidePanelControl>[1],
  withMarkEvidence: boolean,
  cycle: number,
): Promise<void> {
  if (withMarkEvidence) {
    await page.click('#action-event');
    await page.click('#ui-issue');
    await page.waitForTimeout(400);

    await clickSidePanelControl(sidePanel, page, { name: 'Capture bug now' });
    await sidePanel
      .getByRole('textbox', { name: /What went wrong\?/ })
      .fill(`Delete-start cycle ${cycle}`);
    await clickSidePanelControl(sidePanel, page, { name: 'Save bug' });
    await expect(sidePanel.getByText('Bug captured')).toBeVisible({
      timeout: 10_000,
    });
    await clickSidePanelControl(sidePanel, page, {
      name: 'Stop and review',
      withinLabel: 'Bug captured',
    });
    await expect(
      sidePanel.getByLabel('Potential bugs', { exact: true }),
    ).toContainText(`Delete-start cycle ${cycle}`);
    return;
  }

  await page.click('#action-event');
  await page.waitForTimeout(200);
  await stopFromCapture(sidePanel, page);
}

test('delete session then start capture repeats on the same page', async () => {
  test.setTimeout(300_000);
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

    for (let cycle = 0; cycle < 5; cycle += 1) {
      const withMarkEvidence = cycle === 2;

      if (cycle === 0) {
        await startRecordingOnPage(
          launched.context,
          launched.extensionId,
          page,
        );
      } else {
        await stopFromCapture(sidePanel, page);
        await deleteSessionFromSummary(sidePanel, page);
        await startRecordingOnPage(
          launched.context,
          launched.extensionId,
          page,
        );
      }

      await expectCapturingThisTab(sidePanel, page);
      await captureActivityBeforeStop(sidePanel, page, withMarkEvidence, cycle);

      await deleteSessionFromSummary(sidePanel, page);
      await expect(
        sidePanel.getByText('Capture could not start on this page.'),
      ).toHaveCount(0);
      await expect(sidePanel.getByText('No activity yet.')).toBeVisible();
      await expect(sidePanel.getByRole('article')).toHaveCount(0);

      if (cycle === 4) {
        const otherPage = await launched.context.newPage();
        await otherPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await otherPage.bringToFront();
        await page.bringToFront();
      }

      await startRecordingOnPage(launched.context, launched.extensionId, page);
      await expectOneNewActionAfterClick(sidePanel, page);
    }
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
