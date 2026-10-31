/// <reference types="chrome-types" />

import { createServer, type IncomingMessage, type Server } from 'node:http';
import { expect, test } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  launchExtension,
  sendExtensionRuntimeMessage,
} from '../helpers/extension-playwright';

const CONSOLE_TEST_ERROR = 'Issue review console error';

function startReviewTestServer(): Promise<{
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
          '<!doctype html><html><head><title>Issue Review Test</title></head><body><main id="app"><h1>Issue Review Test</h1></main></body></html>',
        );
        return;
      }

      if (pathname === '/api/not-found') {
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('missing');
        return;
      }

      response.writeHead(404);
      response.end('unknown');
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(
          new Error('Could not resolve issue review test server address.'),
        );
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        server,
      });
    });
  });
}

async function readIssueCount(
  context: Awaited<ReturnType<typeof launchExtension>>['context'],
  extensionId: string,
  type:
    'GET_UI_ISSUE_LIST' | 'GET_CONSOLE_ISSUE_LIST' | 'GET_NETWORK_ISSUE_LIST',
): Promise<number> {
  const response: unknown = await sendExtensionRuntimeMessage(
    context,
    extensionId,
    { type },
  );
  if (
    typeof response !== 'object' ||
    response === null ||
    !('issues' in response) ||
    !Array.isArray((response as { issues: unknown[] }).issues)
  ) {
    return 0;
  }
  return (response as { issues: unknown[] }).issues.length;
}

test('reviews UI, console, and network issues in the side panel', async () => {
  const { baseUrl, server } = await startReviewTestServer();
  const launched = await launchExtension();

  try {
    const page = await launched.context.newPage();
    await page.goto(`${baseUrl}/`);
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
        async () =>
          readIssueCount(
            launched.context,
            launched.extensionId,
            'GET_UI_ISSUE_LIST',
          ),
        { timeout: 15_000 },
      )
      .toBe(1);

    await page.evaluate((message) => {
      console.error(message);
    }, CONSOLE_TEST_ERROR);

    await expect
      .poll(
        async () =>
          readIssueCount(
            launched.context,
            launched.extensionId,
            'GET_CONSOLE_ISSUE_LIST',
          ),
        { timeout: 15_000 },
      )
      .toBe(1);

    await page.evaluate(async (origin) => {
      await fetch(`${origin}/api/not-found`);
    }, baseUrl);

    await expect
      .poll(
        async () =>
          readIssueCount(
            launched.context,
            launched.extensionId,
            'GET_NETWORK_ISSUE_LIST',
          ),
        { timeout: 15_000 },
      )
      .toBe(1);

    await page.evaluate((message) => {
      console.error(message);
    }, CONSOLE_TEST_ERROR);

    await expect
      .poll(
        async () => {
          const response: unknown = await sendExtensionRuntimeMessage(
            launched.context,
            launched.extensionId,
            { type: 'GET_CONSOLE_ISSUE_LIST' },
          );
          if (
            typeof response !== 'object' ||
            response === null ||
            !('issues' in response) ||
            !Array.isArray((response as { issues: unknown[] }).issues)
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
      { type: 'STOP_SESSION' },
      page,
    );

    const sidePanel = await launched.context.newPage();
    await sidePanel.goto(
      `chrome-extension://${launched.extensionId}/sidepanel.html`,
    );
    await sidePanel.getByRole('button', { name: 'Issues' }).first().click();

    await expect(
      sidePanel.getByRole('button', { name: 'Include ui issue' }),
    ).toHaveCount(1);

    const consoleRow = sidePanel
      .locator('li')
      .filter({ hasText: CONSOLE_TEST_ERROR })
      .first();
    await consoleRow.getByText('More').click();
    await consoleRow.getByRole('button', { name: 'Mark as expected' }).click();

    const networkRow = sidePanel
      .locator('li')
      .filter({ hasText: /404|GET|not-found/i })
      .first();
    await networkRow
      .getByRole('button', { name: 'Exclude network issue' })
      .click();

    const consoleList: unknown = await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'GET_CONSOLE_ISSUE_LIST' },
    );
    expect(consoleList).toMatchObject({
      ok: true,
      issues: [
        expect.objectContaining({
          message: CONSOLE_TEST_ERROR,
          occurrenceCount: 2,
          disposition: 'expected',
        }),
      ],
    });

    await sidePanel.getByRole('tab', { name: 'UI' }).click();
    await sidePanel.getByText('Bulk actions').click();
    await sidePanel
      .getByRole('button', { name: 'Mark all as expected' })
      .click();

    await expect(
      sidePanel.locator('li').filter({ hasText: /Email is required/ }),
    ).toContainText('Expected');

    await sidePanel.getByRole('tab', { name: 'All' }).click();
    expect(
      await sidePanel.getByRole('button', { name: /Include .* issue/ }).count(),
    ).toBe(3);
    await expect(
      sidePanel.locator('li').filter({ hasText: CONSOLE_TEST_ERROR }),
    ).toContainText('Expected');
    await expect(
      sidePanel.locator('li').filter({ hasText: /Email is required/ }),
    ).toContainText('Expected');
    await expect(
      sidePanel.locator('li').filter({ hasText: /404|GET|not-found/i }),
    ).toContainText('Excluded');
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
