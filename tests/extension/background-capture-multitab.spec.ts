/// <reference types="chrome-types" />

import { expect, test } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  expectCapturingThisTab,
  launchExtension,
  openSidePanelPage,
  startRecordingOnPage,
} from '../helpers/extension-playwright';
import { startDiagnosticsServer } from '../helpers/diagnostics-server';

test('background capture, tab isolation, and other-tab side panel status', async () => {
  test.setTimeout(180_000);
  const { baseUrl, server } = await startDiagnosticsServer();
  const launched = await launchExtension();

  try {
    const capturedTab = await launched.context.newPage();
    await capturedTab.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });

    await capturedTab.bringToFront();
    const sidePanel = await openSidePanelPage(
      launched.context,
      launched.extensionId,
    );
    await startRecordingOnPage(
      launched.context,
      launched.extensionId,
      capturedTab,
    );
    await expectCapturingThisTab(sidePanel, capturedTab);
    await expect(
      sidePanel.getByRole('button', { name: 'Pause' }),
    ).toBeVisible();

    const serviceWorker = launched.context.serviceWorkers()[0];
    await expect
      .poll(async () =>
        serviceWorker.evaluate(async () => chrome.action.getBadgeText({})),
      )
      .toBe('REC');

    await sidePanel.close();

    await capturedTab.bringToFront();
    await capturedTab.click('#console-error');

    const sidePanelAgain = await openSidePanelPage(
      launched.context,
      launched.extensionId,
    );
    await expect(sidePanelAgain.getByText(/Console error:/i)).toBeVisible({
      timeout: 10_000,
    });

    const otherTab = await launched.context.newPage();
    await otherTab.goto(`${baseUrl}/page-two`, {
      waitUntil: 'domcontentloaded',
    });

    const sidePanelOther = await openSidePanelPage(
      launched.context,
      launched.extensionId,
    );
    await expect(
      sidePanelOther.getByText('Capture is running in another tab'),
    ).toBeVisible();
    await expect(
      sidePanelOther.getByRole('button', { name: 'Go to captured tab' }),
    ).toBeVisible();
    await expect(
      sidePanelOther.getByRole('button', { name: 'Stop and review' }),
    ).toBeVisible();

    const potentialIssuesStat = sidePanelOther
      .getByLabel('Capture summary')
      .locator('> div')
      .nth(1)
      .locator('p.tabular-nums');
    const issuesBefore = await potentialIssuesStat.textContent();
    await otherTab.bringToFront();
    await otherTab.click('#console-error');
    await sidePanelOther.bringToFront();
    await expect
      .poll(async () => potentialIssuesStat.textContent())
      .toBe(issuesBefore);

    await sidePanelOther
      .getByRole('button', { name: 'Go to captured tab' })
      .click();
    await expect(capturedTab).toHaveURL(/\/$/);
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
