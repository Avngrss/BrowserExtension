/// <reference types="chrome-types" />

import { expect, test } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  clickSidePanelControl,
  deleteSessionFromSummary,
  expectCapturingThisTab,
  launchExtension,
  openSidePanelPage,
  startRecordingOnPage,
  stopFromCapture,
} from '../helpers/extension-playwright';
import { startDiagnosticsServer } from '../helpers/diagnostics-server';

test('clears side panel data immediately after session deletion', async () => {
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
    await page.click('#console-error');

    await stopFromCapture(sidePanel, page);
    await deleteSessionFromSummary(sidePanel, page);

    await expect(sidePanel.getByText(/No activity yet/i)).toBeVisible();
    await expect(sidePanel.getByLabel('Capture summary')).toContainText(
      'Actions0',
    );
    await expect(sidePanel.getByLabel('Capture summary')).toContainText(
      'Potential issues0',
    );
    await expect(
      sidePanel.getByRole('heading', { name: 'Session Summary' }),
    ).not.toBeVisible();
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
