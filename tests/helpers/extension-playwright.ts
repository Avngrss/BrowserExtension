/// <reference types="chrome-types" />

import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  chromium,
  expect,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const extensionPath = path.resolve('.output/chrome-mv3');

export async function launchExtension(input?: {
  headless?: boolean;
  channel?: 'chromium' | 'chrome' | 'msedge';
  ignoreAutomationFlag?: boolean;
}): Promise<{
  context: BrowserContext;
  extensionId: string;
  userDataDir: string;
}> {
  const userDataDir = await mkdtemp(
    path.join(os.tmpdir(), 'bug-capture-extension-'),
  );
  const extensionArg = extensionPath.replaceAll('\\', '/');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: input?.channel ?? 'chromium',
    headless: input?.headless ?? true,
    ignoreDefaultArgs: input?.ignoreAutomationFlag
      ? ['--enable-automation']
      : undefined,
    args: [
      `--disable-extensions-except=${extensionArg}`,
      `--load-extension=${extensionArg}`,
    ],
  });

  let serviceWorker = context.serviceWorkers()[0];
  if (serviceWorker === undefined) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  const extensionId = new URL(serviceWorker.url()).host;
  return { context, extensionId, userDataDir };
}

async function openExtensionSidePanelBridge(
  context: BrowserContext,
  extensionId: string,
): Promise<Page> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const bridgePage = await context.newPage();
    try {
      await bridgePage.goto(
        `chrome-extension://${extensionId}/sidepanel.html`,
        {
          timeout: 8_000,
          waitUntil: 'domcontentloaded',
        },
      );
      return bridgePage;
    } catch (error) {
      lastError = error;
      await bridgePage.close().catch(() => undefined);
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Could not open extension side panel bridge page.');
}

export async function sendExtensionRuntimeMessage(
  context: BrowserContext,
  extensionId: string,
  message: Record<string, unknown>,
  focusPage?: Page,
): Promise<unknown> {
  const bridgePage = await openExtensionSidePanelBridge(context, extensionId);
  if (focusPage !== undefined) {
    await focusPage.bringToFront();
  }

  try {
    const response: unknown = await bridgePage.evaluate(
      (payload: Record<string, unknown>) => {
        return chrome.runtime.sendMessage(payload) as unknown;
      },
      message,
    );
    return response;
  } finally {
    await bridgePage.close();
  }
}

export async function cleanupExtensionLaunch(input: {
  context: BrowserContext;
  userDataDir: string;
}): Promise<void> {
  await input.context.close();
  await rm(input.userDataDir, { recursive: true, force: true });
}

export async function openSidePanelPage(
  context: BrowserContext,
  extensionId: string,
): Promise<Page> {
  const sidePanel = await context.newPage();
  await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
    waitUntil: 'domcontentloaded',
  });
  return sidePanel;
}

/** Start recording on `targetPage` without focusing the side panel tab (Playwright uses a tab for sidepanel.html). */
async function resolveTargetTabIdForPage(
  bridgePage: Page,
  targetPageUrl: string,
): Promise<number | undefined> {
  return bridgePage.evaluate(async (pageUrl: string) => {
    const normalize = (url: string): string => url.replace(/\/$/, '');
    const wanted = normalize(pageUrl);
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id === undefined || tab.url === undefined) {
        continue;
      }
      if (normalize(tab.url) === wanted) {
        return tab.id;
      }
    }
    return undefined;
  }, targetPageUrl);
}

async function sendSessionStartMessage(
  context: BrowserContext,
  extensionId: string,
  targetPage: Page,
  messageType: 'START_SESSION' | 'START_NEW_CAPTURE',
): Promise<void> {
  await targetPage.bringToFront();
  const targetUrl = targetPage.url();
  const bridgePage = await openExtensionSidePanelBridge(context, extensionId);
  try {
    const targetTabId = await resolveTargetTabIdForPage(bridgePage, targetUrl);
    const response: unknown = await bridgePage.evaluate(
      async (payload: Record<string, unknown>) => {
        const timeoutMs = 20_000;
        const result = await Promise.race([
          chrome.runtime.sendMessage(payload) as Promise<unknown>,
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(
                new Error(
                  `Extension message timed out: ${typeof payload.type === 'string' ? payload.type : 'unknown'}`,
                ),
              );
            }, timeoutMs);
          }),
        ]);
        return result;
      },
      {
        type: messageType,
        ...(targetTabId !== undefined ? { targetTabId } : {}),
      },
    );
    expect(
      response,
      `${messageType} failed: ${JSON.stringify(response)}`,
    ).toMatchObject({
      ok: true,
      state: { status: 'recording' },
    });
  } finally {
    await bridgePage.close();
  }
}

export async function startRecordingOnPage(
  context: BrowserContext,
  extensionId: string,
  targetPage: Page,
): Promise<void> {
  await sendSessionStartMessage(
    context,
    extensionId,
    targetPage,
    'START_SESSION',
  );
}

/** Replace a stopped/reviewed session and start recording on the target tab. */
export async function startNewCaptureOnPage(
  context: BrowserContext,
  extensionId: string,
  targetPage: Page,
): Promise<void> {
  await sendSessionStartMessage(
    context,
    extensionId,
    targetPage,
    'START_NEW_CAPTURE',
  );
}

export async function expectCapturingThisTab(
  sidePanel: Page,
  monitoredPage: Page,
): Promise<void> {
  await monitoredPage.bringToFront();
  await expect(sidePanel.getByText('Capturing this tab')).toBeVisible({
    timeout: 25_000,
  });
}

const GET_CAPTURE_READINESS = 'GET_CAPTURE_READINESS';

/** Poll background until all four collectors report ready on the active session. */
export async function waitForCollectorsReady(
  context: BrowserContext,
  extensionId: string,
  focusPage: Page,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const response: unknown = await sendExtensionRuntimeMessage(
          context,
          extensionId,
          { type: GET_CAPTURE_READINESS },
          focusPage,
        );
        if (
          typeof response !== 'object' ||
          response === null ||
          !('readiness' in response)
        ) {
          return false;
        }
        const readiness = (
          response as {
            readiness: { collectors: Record<string, boolean> } | null;
          }
        ).readiness;
        if (readiness === null) {
          return false;
        }
        const flags = readiness.collectors;
        return flags.actions && flags.ui && flags.console && flags.network;
      },
      { timeout: 25_000 },
    )
    .toBe(true);
}

export async function readCaptureActionCount(sidePanel: Page): Promise<number> {
  const text = await sidePanel
    .getByLabel('Capture summary')
    .locator('.tabular-nums')
    .first()
    .textContent({ timeout: 3_000 });
  return Number(text ?? '0');
}

export async function expectOneNewActionAfterClick(
  sidePanel: Page,
  page: Page,
): Promise<void> {
  await expectCapturingThisTab(sidePanel, page);
  let baseline = -1;
  await expect
    .poll(
      async () => {
        baseline = await readCaptureActionCount(sidePanel);
        return baseline;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(0);

  await page.click('#action-event');

  await expect
    .poll(async () => readCaptureActionCount(sidePanel), { timeout: 15_000 })
    .toBe(baseline + 1);
}

export async function deleteSessionFromSummary(
  sidePanel: Page,
  page: Page,
): Promise<void> {
  await clickSidePanelControl(sidePanel, page, { name: 'Delete session' });
  await page.bringToFront();
  await sidePanel
    .getByRole('button', { name: 'Delete session' })
    .last()
    .evaluate((element) => {
      (element as HTMLElement).click();
    });
  await expect(
    sidePanel.getByRole('button', { name: 'Start capture' }),
  ).toBeVisible({ timeout: 15_000 });
}

export async function stopFromCapture(
  sidePanel: Page,
  page: Page,
): Promise<void> {
  await clickSidePanelControl(sidePanel, page, { name: 'Stop and review' });
  await expect(
    sidePanel.getByRole('heading', { name: 'Session Summary' }),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Clicks a side panel control while keeping the monitored page as the active tab.
 * Playwright's normal click() activates the side panel tab, which disables Capture bug now.
 */
export async function clickSidePanelControl(
  sidePanel: Page,
  monitoredPage: Page,
  options: {
    role?: 'button' | 'radio';
    name: string | RegExp;
    exact?: boolean;
    /** Scope click to a region with this aria-label (exact match). */
    withinLabel?: string;
  },
): Promise<void> {
  await monitoredPage.bringToFront();
  const root =
    options.withinLabel !== undefined
      ? sidePanel.getByLabel(options.withinLabel, { exact: true })
      : sidePanel;
  const role = options.role ?? 'button';
  const locator = root.getByRole(role, {
    name: options.name,
    exact: options.exact,
  });
  await locator.evaluate((element) => {
    (element as HTMLElement).click();
  });
}
