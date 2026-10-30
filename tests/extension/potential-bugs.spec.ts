/// <reference types="chrome-types" />

import { expect, test } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  deleteSessionFromSummary,
  expectCapturingThisTab,
  expectOneNewActionAfterClick,
  launchExtension,
  openSidePanelPage,
  startRecordingOnPage,
  stopFromCapture,
} from '../helpers/extension-playwright';
import { startDiagnosticsServer } from '../helpers/diagnostics-server';
import { POTENTIAL_BUG_GROUPING_WINDOW_MS } from '../../src/domain/potential-bug';

test('two unrelated issues in one session become two potential bugs', async () => {
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
    await page.click('#ui-issue');
    await page.click('#ui-issue');
    await page.waitForTimeout(POTENTIAL_BUG_GROUPING_WINDOW_MS + 1_000);
    await page.click('#console-error');
    await page.waitForTimeout(600);

    await stopFromCapture(sidePanel, page);

    await expect(
      sidePanel.getByRole('heading', { name: '2 potential bugs captured' }),
    ).toBeVisible({ timeout: 15_000 });
    const cards = sidePanel.getByRole('article');
    await expect(cards).toHaveCount(2);

    const uiBug = sidePanel.getByRole('article', { name: 'Potential bug 1' });
    const consoleBug = sidePanel.getByRole('article', {
      name: 'Potential bug 2',
    });
    await expect(uiBug.getByLabel('Factual description')).toContainText(
      'Diagnostics UI issue',
    );
    await expect(uiBug).toContainText('1 related issue');
    await expect(uiBug).not.toContainText('0 relevant Actions');
    await expect(consoleBug.getByLabel('Factual description')).toContainText(
      'Diagnostics console error',
    );
    await expect(consoleBug).toContainText('1 related issue');
    await uiBug.getByRole('button', { name: 'Generate prompt' }).click();
    await expect(
      sidePanel.getByRole('heading', { name: 'Steps for bug ticket' }),
    ).toBeVisible();
    const prompt = sidePanel.getByLabel('Generated prompt');
    await expect(prompt).toHaveValue(/Diagnostics UI issue/);
    await expect(prompt).toHaveValue(
      /Steps \(captured browser actions, oldest first\):\n1\. /,
    );
    await expect(prompt).not.toHaveValue(/Diagnostics console error/);
    await sidePanel.getByRole('button', { name: 'Back to summary' }).click();
    await expect(cards).toHaveCount(2);

    await consoleBug.getByRole('button', { name: 'Exclude' }).click();
    await expect(
      sidePanel.getByRole('heading', { name: '1 potential bug captured' }),
    ).toBeVisible();
    await expect(
      consoleBug.getByRole('button', { name: 'Include' }),
    ).toBeVisible();
    await expect(
      consoleBug.getByRole('button', { name: 'Generate prompt' }),
    ).toBeDisabled();

    await uiBug.getByRole('button', { name: 'Review' }).click();
    await expect(
      sidePanel.getByRole('heading', { name: 'Issue Review' }),
    ).toBeVisible({ timeout: 10_000 });
    await sidePanel.getByRole('button', { name: 'Back to summary' }).click();

    await sidePanel.reload();
    await expect(
      sidePanel.getByRole('heading', { name: '1 potential bug captured' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(cards).toHaveCount(2);

    await deleteSessionFromSummary(sidePanel, page);
    await expect(cards).toHaveCount(0);
    await startRecordingOnPage(launched.context, launched.extensionId, page);
    await expectCapturingThisTab(sidePanel, page);
    await expectOneNewActionAfterClick(sidePanel, page);
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
