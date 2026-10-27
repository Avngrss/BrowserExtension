/// <reference types="chrome-types" />

import { expect, test } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  clickSidePanelControl,
  expectCapturingThisTab,
  launchExtension,
  openSidePanelPage,
  startRecordingOnPage,
  stopFromCapture,
} from '../helpers/extension-playwright';
import { startDiagnosticsServer } from '../helpers/diagnostics-server';

test('session lifecycle with replace confirmation and delete', async () => {
  test.setTimeout(180_000);
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

    await page.bringToFront();
    await page.click('#ui-issue');

    await clickSidePanelControl(sidePanel, page, { name: 'Pause' });
    await expect(sidePanel.getByText('Capture paused')).toBeVisible();
    await page.bringToFront();
    await page.click('#console-error');
    await page.waitForTimeout(800);

    await clickSidePanelControl(sidePanel, page, { name: 'Resume' });
    await expectCapturingThisTab(sidePanel, page);
    await stopFromCapture(sidePanel, page);
    await expect(sidePanel.getByText('Reviewing')).toBeVisible();

    await sidePanel.close();
    const sidePanelAgain = await openSidePanelPage(
      launched.context,
      launched.extensionId,
    );
    await expect(
      sidePanelAgain.getByRole('heading', { name: 'Session Summary' }),
    ).toBeVisible({ timeout: 10_000 });

    await clickSidePanelControl(sidePanelAgain, page, {
      name: 'Start new capture',
    });
    await expect(
      sidePanelAgain.getByText(
        'Starting a new capture will delete the current session data.',
      ),
    ).toBeVisible();
    await clickSidePanelControl(sidePanelAgain, page, {
      name: 'Keep current session',
    });
    await expect(
      sidePanelAgain.getByRole('heading', { name: 'Session Summary' }),
    ).toBeVisible();

    await clickSidePanelControl(sidePanelAgain, page, {
      name: 'Start new capture',
    });
    await page.bringToFront();
    await sidePanelAgain
      .getByRole('button', { name: 'Start new capture' })
      .last()
      .evaluate((element) => {
        (element as HTMLElement).click();
      });
    await expectCapturingThisTab(sidePanelAgain, page);

    await stopFromCapture(sidePanelAgain, page);

    await clickSidePanelControl(sidePanelAgain, page, {
      name: 'Delete session',
    });
    await expect(
      sidePanelAgain.getByText(
        'This removes all actions, issues, dispositions, potential bugs, and screenshots from this session.',
      ),
    ).toBeVisible();
    await page.bringToFront();
    await sidePanelAgain
      .getByRole('button', { name: 'Delete session' })
      .last()
      .evaluate((element) => {
        (element as HTMLElement).click();
      });
    await expect(
      sidePanelAgain.getByRole('button', { name: 'Start capture' }),
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
