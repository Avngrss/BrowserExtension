/// <reference types="chrome-types" />

import { createServer, type IncomingMessage, type Server } from 'node:http';
import { expect, test } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  launchExtension,
  sendExtensionRuntimeMessage,
} from '../helpers/extension-playwright';

const CONSOLE_TEST_ERROR = 'Simplified UX console error';

function startUxTestServer(): Promise<{ baseUrl: string; server: Server }> {
  return new Promise((resolve, reject) => {
    const server = createServer((request: IncomingMessage, response) => {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1:0');
      const pathname = requestUrl.pathname;

      if (pathname === '/' || pathname === '/index.html') {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(
          '<!doctype html><html><head><title>Simplified UX Test</title></head><body><main id="app"><h1>Simplified UX Test</h1><button id="go">Go</button></main></body></html>',
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
        reject(new Error('Could not resolve UX test server address.'));
        return;
      }
      resolve({ baseUrl: `http://127.0.0.1:${address.port}`, server });
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

test('simplified capture, summary, and review flow', async () => {
  const { baseUrl, server } = await startUxTestServer();
  const launched = await launchExtension();
  const pageErrors: string[] = [];

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

    await page.click('#go');
    await page.waitForTimeout(300);

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

    const sidePanel = await launched.context.newPage();
    sidePanel.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    await sidePanel.goto(
      `chrome-extension://${launched.extensionId}/sidepanel.html`,
    );

    await expect(sidePanel.getByLabel('Capture summary')).toBeVisible();
    await expect(
      sidePanel.getByRole('button', { name: 'Include' }),
    ).toHaveCount(0);

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'STOP_SESSION' },
      page,
    );
    await sidePanel.reload();

    await expect(
      sidePanel.getByRole('region', { name: 'Session Summary' }),
    ).toBeVisible();

    await sidePanel.getByRole('button', { name: 'Issues' }).first().click();
    await expect(
      sidePanel.getByRole('region', { name: 'Issue Review' }),
    ).toBeVisible();
    await expect(sidePanel.getByText(/Clicked button/)).toHaveCount(0);
    await expect(sidePanel.getByText(/Email is required/)).toBeVisible();

    const networkRow = sidePanel
      .locator('li')
      .filter({ hasText: /404|GET|not-found/i })
      .first();
    await networkRow
      .getByRole('button', { name: 'Exclude network issue' })
      .click();

    const consoleRow = sidePanel
      .locator('li')
      .filter({ hasText: CONSOLE_TEST_ERROR })
      .first();
    await consoleRow.getByText('More').click();
    await consoleRow.getByRole('button', { name: 'Mark as expected' }).click();

    await sidePanel.getByText('Bulk actions').click();
    await sidePanel
      .getByRole('button', { name: 'Mark all as expected' })
      .click();

    await sidePanel.getByRole('button', { name: 'Back to summary' }).click();
    await expect(
      sidePanel.getByRole('region', { name: 'Session Summary' }),
    ).toBeVisible();

    const reopened = await launched.context.newPage();
    reopened.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    await reopened.goto(
      `chrome-extension://${launched.extensionId}/sidepanel.html`,
    );
    await expect(
      reopened.getByRole('region', { name: 'Session Summary' }),
    ).toBeVisible();

    const options = await launched.context.newPage();
    options.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    await options.goto(
      `chrome-extension://${launched.extensionId}/options.html`,
    );
    await expect(options.getByText('Advanced UI issue rules')).toBeVisible();
    const advanced = options
      .getByText('Advanced UI issue rules')
      .locator('xpath=ancestor::details[1]');
    await expect(advanced).not.toHaveAttribute('open');
    await options.getByText('Advanced UI issue rules').click();
    await expect(options.getByText('Alert role')).toBeVisible();
    await expect(options.locator('#root')).not.toBeEmpty();

    expect(pageErrors).toEqual([]);
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
