/// <reference types="chrome-types" />

import { expect, test, type BrowserContext } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  clickSidePanelControl,
  expectCapturingThisTab,
  launchExtension,
  openSidePanelPage,
  sendExtensionRuntimeMessage,
  startNewCaptureOnPage,
  startRecordingOnPage,
  waitForCollectorsReady,
} from '../helpers/extension-playwright';
import { startDiagnosticsServer } from '../helpers/diagnostics-server';

const EXTENSION_SETTINGS_STORAGE_KEY = 'extensionSettings.v1';

const BASE_EXTENSION_SETTINGS = {
  capture: {
    captureActions: true,
    captureUiIssues: true,
    captureConsoleErrors: true,
    captureNetworkFailures: true,
  },
  privacy: {
    redactSensitiveUrlParameters: true,
    removeUrlHash: true,
    neverStoreTextFieldValues: true,
    protectPasswordAndPrivateFields: true,
  },
  limits: {
    maxActionsPerSession: 100,
    maxUniqueUiIssues: 100,
    maxUniqueConsoleIssues: 100,
    maxUniqueNetworkIssues: 100,
  },
  screenshots: {
    captureAutomatically: true,
    uiIssues: true,
    consoleIssues: true,
    networkIssues: true,
    maxPerSession: 10,
  },
};

type ScreenshotRecord = {
  id: string;
  issueCategory: string;
  issueId: string;
  status: string;
  failureReason?: string;
};

async function readScreenshotEvidence(
  context: BrowserContext,
  extensionId: string,
  refocusPage: import('@playwright/test').Page,
): Promise<ScreenshotRecord[]> {
  const response: unknown = await sendExtensionRuntimeMessage(
    context,
    extensionId,
    { type: 'GET_SCREENSHOT_EVIDENCE_LIST' },
    refocusPage,
  );
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

function countCaptured(records: ScreenshotRecord[]): number {
  return records.filter((record) => record.status === 'captured').length;
}

test('automatic screenshot evidence in production build', async () => {
  test.setTimeout(120_000);
  const { baseUrl, server } = await startDiagnosticsServer();
  const launched = await launchExtension();
  const externalImagePosts: string[] = [];

  launched.context.on('request', (request) => {
    const url = request.url();
    if (
      request.method() === 'POST' &&
      !url.startsWith('chrome-extension://') &&
      !url.startsWith('http://127.0.0.1')
    ) {
      externalImagePosts.push(url);
    }
  });

  try {
    const page = await launched.context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.bringToFront();

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'HEALTH_CHECK' },
      page,
    );

    await startRecordingOnPage(launched.context, launched.extensionId, page);
    await waitForCollectorsReady(launched.context, launched.extensionId, page);

    await page.click('#action-event');
    await page.waitForTimeout(400);

    await page.bringToFront();
    await page.click('#ui-issue');
    await page.waitForTimeout(2_000);
    await expect
      .poll(
        async () =>
          countCaptured(
            await readScreenshotEvidence(
              launched.context,
              launched.extensionId,
              page,
            ),
          ),
        { timeout: 20_000, intervals: [1_000] },
      )
      .toBe(1);

    const afterUi = await readScreenshotEvidence(
      launched.context,
      launched.extensionId,
      page,
    );
    expect(afterUi.filter((item) => item.issueCategory === 'ui')).toHaveLength(
      1,
    );

    await page.click('#ui-issue');
    await page.waitForTimeout(800);
    expect(
      countCaptured(
        await readScreenshotEvidence(
          launched.context,
          launched.extensionId,
          page,
        ),
      ),
    ).toBe(1);

    await page.bringToFront();
    await page.click('#console-error');
    await page.waitForTimeout(4_000);
    await page.bringToFront();
    expect(
      countCaptured(
        await readScreenshotEvidence(
          launched.context,
          launched.extensionId,
          page,
        ),
      ),
    ).toBe(1);
    expect(
      (
        await readScreenshotEvidence(
          launched.context,
          launched.extensionId,
          page,
        )
      ).filter((item) => item.issueCategory === 'console'),
    ).toHaveLength(0);

    await page.click('#fetch-404');
    await page.waitForTimeout(4_000);
    await page.bringToFront();
    expect(
      countCaptured(
        await readScreenshotEvidence(
          launched.context,
          launched.extensionId,
          page,
        ),
      ),
    ).toBe(1);

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'STOP_SESSION' },
      page,
    );

    const sidePanel = await openSidePanelPage(
      launched.context,
      launched.extensionId,
    );

    await expect(
      sidePanel
        .getByRole('article', { name: 'Potential bug 1' })
        .getByText('1 screenshot', { exact: true }),
    ).toBeVisible();

    await page.bringToFront();
    await sidePanel
      .getByRole('button', { name: 'Issues' })
      .first()
      .evaluate((element) => {
        (element as HTMLElement).click();
      });
    await expect(
      sidePanel
        .getByRole('img', { name: 'Issue screenshot thumbnail' })
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await page.bringToFront();
    await sidePanel
      .getByRole('button', { name: 'View screenshot' })
      .first()
      .evaluate((element) => {
        (element as HTMLElement).click();
      });
    await expect(
      sidePanel.getByRole('dialog', { name: 'Screenshot preview' }),
    ).toBeVisible();
    await sidePanel.keyboard.press('Escape');
    await expect(
      sidePanel.getByRole('dialog', { name: 'Screenshot preview' }),
    ).toHaveCount(0);

    const uiRow = sidePanel
      .locator('li')
      .filter({ hasText: /Diagnostics UI issue/i })
      .first();
    await page.bringToFront();
    await uiRow
      .getByRole('button', { name: 'Remove screenshot' })
      .evaluate((element) => {
        (element as HTMLElement).click();
      });
    await expect(
      uiRow.getByRole('img', { name: 'Issue screenshot thumbnail' }),
    ).toHaveCount(0);
    await expect(uiRow.getByText(/Diagnostics UI issue/i)).toBeVisible();

    const networkRow = sidePanel
      .locator('li')
      .filter({ hasText: /404|diagnostics-missing|GET/i })
      .first();
    const excludeNetwork = networkRow.getByRole('button', {
      name: 'Exclude network issue',
    });
    await page.bringToFront();
    await excludeNetwork.evaluate((element) => {
      (element as HTMLElement).click();
    });
    await expect(excludeNetwork).toHaveAttribute('aria-pressed', 'true');
    await expect(
      networkRow.getByRole('img', { name: 'Issue screenshot thumbnail' }),
    ).toHaveCount(0);
    await expect(networkRow.getByText(/Screenshot unavailable/i)).toHaveCount(
      0,
    );

    await clickSidePanelControl(sidePanel, page, { name: 'Back to summary' });
    await clickSidePanelControl(sidePanel, page, { name: 'Start new capture' });
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
    await waitForCollectorsReady(launched.context, launched.extensionId, page);

    await expect
      .poll(
        async () =>
          (
            await readScreenshotEvidence(
              launched.context,
              launched.extensionId,
              page,
            )
          ).length,
        { timeout: 10_000 },
      )
      .toBe(0);

    const bridgePage = await launched.context.newPage();
    await bridgePage.goto(
      `chrome-extension://${launched.extensionId}/sidepanel.html`,
    );
    await bridgePage.evaluate(
      ([key, settings]) => {
        return chrome.storage.local.set({
          [key]: {
            ...settings,
            screenshots: {
              ...settings.screenshots,
              consoleIssues: true,
            },
          },
        });
      },
      [EXTENSION_SETTINGS_STORAGE_KEY, BASE_EXTENSION_SETTINGS] as const,
    );
    await bridgePage.close();
    await page.waitForTimeout(500);

    await sidePanel.close();
    await page.bringToFront();

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'STOP_SESSION' },
      page,
    );
    await startNewCaptureOnPage(launched.context, launched.extensionId, page);
    await waitForCollectorsReady(launched.context, launched.extensionId, page);

    await page.bringToFront();
    await page.click('#console-error');
    await expect
      .poll(
        async () => {
          const records = (
            await readScreenshotEvidence(
              launched.context,
              launched.extensionId,
              page,
            )
          ).filter((item) => item.issueCategory === 'console');
          return records[0]?.status ?? '';
        },
        { timeout: 20_000, intervals: [500] },
      )
      .toBe('captured');

    await page.bringToFront();
    await page.click('#ui-issue');
    await page.waitForTimeout(4_000);
    await page.bringToFront();
    expect(
      countCaptured(
        await readScreenshotEvidence(
          launched.context,
          launched.extensionId,
          page,
        ),
      ),
    ).toBe(2);

    await waitForCollectorsReady(launched.context, launched.extensionId, page);
    expect(externalImagePosts).toEqual([]);
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
