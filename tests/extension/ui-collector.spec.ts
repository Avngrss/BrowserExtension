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

const extensionPath = path.resolve('.output/chrome-mv3');

function startUiTestServer(): Promise<{ url: string; server: Server }> {
  return new Promise((resolve, reject) => {
    const server = createServer((_request, response) => {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(
        '<!doctype html><html><head><title>UI Collector Test</title></head><body><main id="app"><h1>UI Collector Test</h1></main></body></html>',
      );
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Could not resolve UI test server address.'));
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
    path.join(os.tmpdir(), 'bug-capture-ui-collector-'),
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

async function readUiIssueCount(
  context: BrowserContext,
  extensionId: string,
): Promise<number> {
  const response: unknown = await sendExtensionRuntimeMessage(
    context,
    extensionId,
    { type: 'GET_UI_ISSUE_LIST' },
  );

  if (
    typeof response !== 'object' ||
    response === null ||
    !('ok' in response) ||
    response.ok !== true ||
    !('issues' in response) ||
    !Array.isArray((response as { issues: unknown }).issues)
  ) {
    throw new Error('Could not read UI issues from the extension.');
  }

  return (response as { issues: unknown[] }).issues.length;
}

test('captures selector-based UI issues while recording', async () => {
  const { url, server } = await startUiTestServer();
  const launched = await launchExtension();

  try {
    const page = await launched.context.newPage();
    await page.goto(url);
    await page.bringToFront();

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'START_SESSION' },
      page,
    );
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      const alert = document.createElement('div');
      alert.setAttribute('role', 'alert');
      alert.textContent = 'Email is required';
      document.getElementById('app')?.appendChild(alert);
    });

    await expect
      .poll(
        async () => readUiIssueCount(launched.context, launched.extensionId),
        { timeout: 15_000 },
      )
      .toBe(1);

    await page.evaluate(() => {
      const hidden = document.createElement('div');
      hidden.setAttribute('role', 'alert');
      hidden.textContent = 'Hidden error';
      hidden.style.display = 'none';
      document.getElementById('app')?.appendChild(hidden);
    });

    await page.waitForTimeout(500);
    expect(await readUiIssueCount(launched.context, launched.extensionId)).toBe(
      1,
    );

    await page.evaluate(() => {
      const marker = document.createElement('div');
      marker.textContent = 'Unrelated update';
      document.getElementById('app')?.appendChild(marker);
    });
    await page.waitForTimeout(500);
    expect(await readUiIssueCount(launched.context, launched.extensionId)).toBe(
      1,
    );

    await page.evaluate(() => {
      const alert = document.querySelector('[role="alert"]');
      alert?.remove();
      const replacement = document.createElement('div');
      replacement.setAttribute('role', 'alert');
      replacement.textContent = 'Email is required';
      document.getElementById('app')?.appendChild(replacement);
    });

    await expect
      .poll(
        async () => {
          const response: unknown = await sendExtensionRuntimeMessage(
            launched.context,
            launched.extensionId,
            { type: 'GET_UI_ISSUE_LIST' },
          );
          if (
            typeof response !== 'object' ||
            response === null ||
            !('issues' in response)
          ) {
            return 0;
          }
          const issue = (response as { issues: { occurrenceCount: number }[] })
            .issues[0];
          return issue?.occurrenceCount ?? 0;
        },
        { timeout: 15_000 },
      )
      .toBe(2);

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'PAUSE_SESSION' },
      page,
    );
    await page.waitForTimeout(400);

    await page.evaluate(() => {
      const alert = document.createElement('div');
      alert.setAttribute('role', 'alert');
      alert.textContent = 'Paused error';
      document.getElementById('app')?.appendChild(alert);
    });
    await page.waitForTimeout(500);
    expect(await readUiIssueCount(launched.context, launched.extensionId)).toBe(
      1,
    );

    await page.evaluate(() => {
      document.querySelectorAll('[role="alert"]').forEach((node) => {
        if (node.textContent?.includes('Paused error')) {
          node.remove();
        }
      });
    });

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'RESUME_SESSION' },
      page,
    );
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      const alert = document.createElement('div');
      alert.setAttribute('data-testid', 'error-message');
      alert.textContent = 'Payment method is unavailable';
      document.getElementById('app')?.appendChild(alert);
    });

    await expect
      .poll(
        async () => readUiIssueCount(launched.context, launched.extensionId),
        { timeout: 15_000 },
      )
      .toBe(2);

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'STOP_SESSION' },
      page,
    );
    await page.waitForTimeout(400);

    await page.evaluate(() => {
      const alert = document.createElement('div');
      alert.setAttribute('role', 'alert');
      alert.textContent = 'After stop';
      document.getElementById('app')?.appendChild(alert);
    });
    await page.waitForTimeout(500);
    expect(await readUiIssueCount(launched.context, launched.extensionId)).toBe(
      2,
    );

    await page.evaluate(() => {
      console.error('UI collector console check');
    });
    await page.evaluate(
      async (origin) => {
        await fetch(`${origin}/missing`, { method: 'GET' }).catch(
          () => undefined,
        );
      },
      url.replace(/\/$/, ''),
    );

    const sidePanel = await launched.context.newPage();
    await sidePanel.goto(
      `chrome-extension://${launched.extensionId}/sidepanel.html`,
    );
    await expect(
      sidePanel.getByRole('region', { name: 'Session Summary' }),
    ).toBeVisible();
    await page.bringToFront();
    await sidePanel
      .getByRole('button', { name: 'Review', exact: true })
      .first()
      .evaluate((element) => {
        (element as HTMLElement).click();
      });
    await sidePanel.getByRole('tab', { name: 'UI' }).evaluate((element) => {
      (element as HTMLElement).click();
    });
    await expect(sidePanel.getByRole('listitem')).toHaveCount(2);
  } finally {
    server.close();
    await launched.context.close();
    await rm(launched.userDataDir, { recursive: true, force: true });
  }
});
