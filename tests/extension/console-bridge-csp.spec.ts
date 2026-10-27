/// <reference types="chrome-types" />

import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import {
  expectCapturingThisTab,
  openSidePanelPage,
  startRecordingOnPage,
  waitForCollectorsReady,
} from '../helpers/extension-playwright';

const extensionPath = path.resolve('.output/chrome-mv3');
const TEST_ERROR = 'Bug Capture Assistant test error';
function startCspServer(): Promise<{ url: string; server: Server }> {
  return new Promise((resolve, reject) => {
    const server = createServer((_request, response) => {
      response.setHeader(
        'Content-Security-Policy',
        "script-src 'self'; object-src 'none'; base-uri 'none'",
      );
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(
        '<!doctype html><html><head><title>CSP Console Test</title></head><body><h1>CSP Console Test</h1></body></html>',
      );
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Could not resolve CSP test server address.'));
        return;
      }
      resolve({ url: `http://127.0.0.1:${address.port}/`, server });
    });
  });
}

async function launchExtension(): Promise<{
  context: BrowserContext;
  extensionId: string;
  userDataDir: string;
}> {
  const userDataDir = await mkdtemp(
    path.join(os.tmpdir(), 'bug-capture-console-bridge-'),
  );
  const extensionArg = extensionPath.replaceAll('\\', '/');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
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

async function sendExtensionRuntimeMessage(
  context: BrowserContext,
  extensionId: string,
  message: Record<string, string>,
  focusPage?: Page,
): Promise<unknown> {
  const bridgePage = await context.newPage();
  await bridgePage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  if (focusPage !== undefined) {
    await focusPage.bringToFront();
  }

  try {
    return await bridgePage.evaluate(async (payload) => {
      return chrome.runtime.sendMessage(payload);
    }, message);
  } finally {
    await bridgePage.close();
  }
}

async function readConsoleIssueCount(
  context: BrowserContext,
  extensionId: string,
  focusPage: Page,
): Promise<number> {
  const response: unknown = await sendExtensionRuntimeMessage(
    context,
    extensionId,
    { type: 'GET_CONSOLE_ISSUE_LIST' },
    focusPage,
  );

  if (
    typeof response !== 'object' ||
    response === null ||
    !('ok' in response) ||
    response.ok !== true ||
    !('issues' in response) ||
    !Array.isArray((response as { issues: unknown }).issues)
  ) {
    throw new Error('Could not read console issues from the extension.');
  }

  return (response as { issues: unknown[] }).issues.length;
}

test('captures console errors on a CSP-protected page without bridge violations', async () => {
  const { url, server } = await startCspServer();
  const launched = await launchExtension();
  const cspViolations: string[] = [];

  try {
    const page = await launched.context.newPage();
    page.on('console', (message) => {
      const text = message.text();
      if (
        message.type() === 'error' &&
        text.includes('Content Security Policy') &&
        text.includes('console-bridge')
      ) {
        cspViolations.push(text);
      }
    });

    await page.goto(url);
    await page.bringToFront();
    const sidePanel = await openSidePanelPage(
      launched.context,
      launched.extensionId,
    );
    await startRecordingOnPage(launched.context, launched.extensionId, page);
    await waitForCollectorsReady(launched.context, launched.extensionId, page);
    await expectCapturingThisTab(sidePanel, page);
    await page.evaluate((message) => {
      console.error(message);
    }, TEST_ERROR);

    await expect
      .poll(
        async () =>
          readConsoleIssueCount(launched.context, launched.extensionId, page),
        {
          timeout: 15_000,
        },
      )
      .toBe(1);

    await page.evaluate((message) => {
      console.error(message);
    }, TEST_ERROR);

    await expect
      .poll(
        async () =>
          readConsoleIssueCount(launched.context, launched.extensionId, page),
        {
          timeout: 15_000,
        },
      )
      .toBe(1);

    const issues: unknown = await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'GET_CONSOLE_ISSUE_LIST' },
      page,
    );

    expect(issues).toMatchObject({
      ok: true,
      issues: [
        expect.objectContaining({
          message: TEST_ERROR,
          occurrenceCount: 2,
        }),
      ],
    });

    await expect(sidePanel.getByLabel('Capture summary')).toBeVisible();
    await expect(
      sidePanel.getByText(/Console error: Bug Capture Assistant test error/),
    ).toBeVisible({ timeout: 15_000 });

    expect(cspViolations).toEqual([]);
  } finally {
    server.close();
    await launched.context.close();
    await rm(launched.userDataDir, { recursive: true, force: true });
  }
});
