/// <reference types="chrome-types" />

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
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

const extensionPath = path.resolve('.output/chrome-mv3');

test('toolbar action opens side panel and delete session uses danger styling', async () => {
  test.setTimeout(180_000);
  const { baseUrl, server } = await startDiagnosticsServer();
  const launched = await launchExtension();

  try {
    const manifestText = await readFile(
      path.join(extensionPath, 'manifest.json'),
      'utf8',
    );
    const manifest = JSON.parse(manifestText) as {
      action?: { default_popup?: string };
    };
    expect(manifest.action?.default_popup).toBeUndefined();
    await expect(
      access(path.join(extensionPath, 'popup.html')),
    ).rejects.toThrow();

    const backgroundSource = await readFile(
      path.join(extensionPath, 'background.js'),
      'utf8',
    );
    expect(backgroundSource).toContain('openPanelOnActionClick');

    const page = await launched.context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.bringToFront();

    const sidePanel = await openSidePanelPage(
      launched.context,
      launched.extensionId,
    );
    await expect(
      sidePanel.getByRole('heading', { name: 'Bug Capture Assistant' }),
    ).toBeVisible();
    await expect(
      sidePanel.getByRole('button', { name: 'Settings' }),
    ).toBeVisible();
    await expect(
      sidePanel.getByRole('button', { name: 'Start capture' }),
    ).toBeEnabled();

    await startRecordingOnPage(launched.context, launched.extensionId, page);
    await expectCapturingThisTab(sidePanel, page);
    await stopFromCapture(sidePanel, page);

    const deleteButton = sidePanel.getByRole('button', {
      name: 'Delete session',
    });
    await expect(deleteButton).toHaveAttribute('data-variant', 'danger');

    await clickSidePanelControl(sidePanel, page, { name: 'Delete session' });
    await clickSidePanelControl(sidePanel, page, {
      name: 'Keep current session',
    });
    await expect(
      sidePanel.getByRole('heading', { name: 'Session Summary' }),
    ).toBeVisible();

    await clickSidePanelControl(sidePanel, page, { name: 'Delete session' });
    const confirmDelete = sidePanel
      .getByRole('button', { name: 'Delete session' })
      .last();
    await expect(confirmDelete).toHaveAttribute('data-variant', 'danger');
    await page.bringToFront();
    await confirmDelete.evaluate((element) => {
      (element as HTMLElement).click();
    });
    await expect(
      sidePanel.getByRole('button', { name: 'Start capture' }),
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
