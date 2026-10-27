/// <reference types="chrome-types" />

import { createServer, type IncomingMessage, type Server } from 'node:http';
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
const CONSOLE_TEST_ERROR = 'Bug Capture Assistant network console check';

function startNetworkTestServer(): Promise<{
  baseUrl: string;
  server: Server;
}> {
  return new Promise((resolve, reject) => {
    const server = createServer((request: IncomingMessage, response) => {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1:0');
      const pathname = requestUrl.pathname;

      if (pathname === '/' || pathname === '/index.html') {
        response.setHeader(
          'Content-Security-Policy',
          "script-src 'self'; object-src 'none'; base-uri 'none'",
        );
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(
          '<!doctype html><html><head><title>Network CSP Test</title></head><body><h1>Network CSP Test</h1></body></html>',
        );
        return;
      }

      if (pathname === '/api/ok') {
        response.writeHead(200, { 'Content-Type': 'text/plain' });
        response.end('ok');
        return;
      }
      if (pathname === '/api/not-found') {
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('missing');
        return;
      }
      if (pathname === '/api/server-error') {
        response.writeHead(500, { 'Content-Type': 'text/plain' });
        response.end('error');
        return;
      }
      if (pathname === '/api/slow') {
        setTimeout(() => {
          response.writeHead(200, { 'Content-Type': 'text/plain' });
          response.end('slow');
        }, 2_000);
        return;
      }

      response.writeHead(404);
      response.end('unknown');
    });

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Could not resolve network test server address.'));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        server,
      });
    });
  });
}

async function launchExtension(): Promise<{
  context: BrowserContext;
  extensionId: string;
  userDataDir: string;
}> {
  const userDataDir = await mkdtemp(
    path.join(os.tmpdir(), 'bug-capture-network-bridge-'),
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

async function startRecording(
  context: BrowserContext,
  extensionId: string,
  targetPage: Page,
): Promise<void> {
  const response: unknown = await sendExtensionRuntimeMessage(
    context,
    extensionId,
    { type: 'START_SESSION' },
    targetPage,
  );
  expect(response).toMatchObject({ ok: true, state: { status: 'recording' } });
}

async function readNetworkIssueCount(
  context: BrowserContext,
  extensionId: string,
): Promise<number> {
  const response: unknown = await sendExtensionRuntimeMessage(
    context,
    extensionId,
    { type: 'GET_NETWORK_ISSUE_LIST' },
  );

  if (
    typeof response !== 'object' ||
    response === null ||
    !('ok' in response) ||
    response.ok !== true ||
    !('issues' in response) ||
    !Array.isArray((response as { issues: unknown }).issues)
  ) {
    throw new Error('Could not read network issues from the extension.');
  }

  return (response as { issues: unknown[] }).issues.length;
}

async function readConsoleIssueCount(
  context: BrowserContext,
  extensionId: string,
): Promise<number> {
  const response: unknown = await sendExtensionRuntimeMessage(
    context,
    extensionId,
    { type: 'GET_CONSOLE_ISSUE_LIST' },
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

test('captures fetch and xhr network failures on a CSP-protected page', async () => {
  const { baseUrl, server } = await startNetworkTestServer();
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

    await page.goto(`${baseUrl}/`);
    await page.bringToFront();
    await startRecording(launched.context, launched.extensionId, page);
    await page.waitForTimeout(500);

    await page.evaluate(async (origin) => {
      await fetch(`${origin}/api/ok`);
    }, baseUrl);

    await expect
      .poll(
        async () =>
          readNetworkIssueCount(launched.context, launched.extensionId),
        { timeout: 5_000 },
      )
      .toBe(0);

    await page.evaluate(async (origin) => {
      await fetch(`${origin}/api/not-found`);
    }, baseUrl);
    await expect
      .poll(
        async () =>
          readNetworkIssueCount(launched.context, launched.extensionId),
        { timeout: 15_000 },
      )
      .toBe(1);

    await page.evaluate(async (origin) => {
      await fetch(`${origin}/api/server-error`);
    }, baseUrl);

    await expect
      .poll(
        async () =>
          readNetworkIssueCount(launched.context, launched.extensionId),
        { timeout: 15_000 },
      )
      .toBe(2);

    await page.evaluate(async (origin) => {
      await fetch(`${origin}/api/not-found`);
    }, baseUrl);

    const issuesAfterRepeat: unknown = await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'GET_NETWORK_ISSUE_LIST' },
    );
    expect(issuesAfterRepeat).toMatchObject({
      ok: true,
      issues: expect.arrayContaining([
        expect.objectContaining({
          status: 404,
          occurrenceCount: 2,
        }),
      ]),
    });

    await page.evaluate(
      (origin) =>
        new Promise<number>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', `${origin}/api/server-error`);
          xhr.addEventListener('load', () => {
            resolve(Number(xhr.status));
          });
          xhr.addEventListener('error', () => {
            reject(new Error('XHR error'));
          });
          xhr.send();
        }),
      baseUrl,
    );

    await expect
      .poll(
        async () =>
          readNetworkIssueCount(launched.context, launched.extensionId),
        { timeout: 15_000 },
      )
      .toBe(3);

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'PAUSE_SESSION' },
      page,
    );
    await page.waitForTimeout(300);

    await page.evaluate(async (origin) => {
      await fetch(`${origin}/api/not-found`);
    }, baseUrl);

    await expect
      .poll(
        async () =>
          readNetworkIssueCount(launched.context, launched.extensionId),
        { timeout: 5_000 },
      )
      .toBe(3);

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'RESUME_SESSION' },
      page,
    );
    await page.waitForTimeout(500);

    await page.evaluate(async (origin) => {
      await fetch(`${origin}/api/server-error`);
    }, baseUrl);

    await expect
      .poll(
        async () => {
          const response: unknown = await sendExtensionRuntimeMessage(
            launched.context,
            launched.extensionId,
            { type: 'GET_NETWORK_ISSUE_LIST' },
          );
          if (
            typeof response !== 'object' ||
            response === null ||
            !('issues' in response)
          ) {
            return 0;
          }
          const match = (
            response as {
              issues: { status?: number; occurrenceCount: number }[];
            }
          ).issues.find(
            (issue) => issue.status === 500 && issue.source === 'fetch',
          );
          return match?.occurrenceCount ?? 0;
        },
        { timeout: 15_000 },
      )
      .toBe(2);

    await page.evaluate((message) => {
      console.error(message);
    }, CONSOLE_TEST_ERROR);

    await expect
      .poll(
        async () =>
          readConsoleIssueCount(launched.context, launched.extensionId),
        { timeout: 15_000 },
      )
      .toBe(1);

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'STOP_SESSION' },
      page,
    );
    await page.waitForTimeout(300);

    await page.evaluate(async (origin) => {
      await fetch(`${origin}/api/server-error`);
    }, baseUrl);

    await expect
      .poll(
        async () =>
          readNetworkIssueCount(launched.context, launched.extensionId),
        { timeout: 5_000 },
      )
      .toBe(3);

    await page.evaluate((message) => {
      console.error(`${message} after stop`);
    }, CONSOLE_TEST_ERROR);

    const sidePanel = await launched.context.newPage();
    await sidePanel.goto(
      `chrome-extension://${launched.extensionId}/sidepanel.html`,
    );
    await expect(
      sidePanel.getByRole('region', { name: 'Session Summary' }),
    ).toBeVisible({ timeout: 15_000 });
    await page.bringToFront();
    await sidePanel
      .getByRole('button', { name: 'Review', exact: true })
      .first()
      .evaluate((element) => {
        (element as HTMLElement).click();
      });
    await sidePanel
      .getByRole('tab', { name: 'Network' })
      .evaluate((element) => {
        (element as HTMLElement).click();
      });
    await expect(sidePanel.getByRole('listitem')).toHaveCount(3);

    expect(cspViolations).toEqual([]);
  } finally {
    server.close();
    await launched.context.close();
    await rm(launched.userDataDir, { recursive: true, force: true });
  }
});
