/// <reference types="chrome-types" />

import { expect, test } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  launchExtension,
  sendExtensionRuntimeMessage,
  startNewCaptureOnPage,
  startRecordingOnPage,
  waitForCollectorsReady,
} from '../helpers/extension-playwright';
import { startDiagnosticsServer } from '../helpers/diagnostics-server';
import type { Page } from '@playwright/test';

async function readCount(
  context: Awaited<ReturnType<typeof launchExtension>>['context'],
  extensionId: string,
  focusPage: Page,
  type:
    | 'GET_ACTION_LIST'
    | 'GET_UI_ISSUE_LIST'
    | 'GET_CONSOLE_ISSUE_LIST'
    | 'GET_NETWORK_ISSUE_LIST',
): Promise<number> {
  const response: unknown = await sendExtensionRuntimeMessage(
    context,
    extensionId,
    { type },
    focusPage,
  );
  if (typeof response !== 'object' || response === null) {
    return 0;
  }
  if (
    'actions' in response &&
    Array.isArray((response as { actions: unknown[] }).actions)
  ) {
    return (response as { actions: unknown[] }).actions.length;
  }
  if (
    'issues' in response &&
    Array.isArray((response as { issues: unknown[] }).issues)
  ) {
    return (response as { issues: unknown[] }).issues.length;
  }
  return 0;
}

async function readSessionId(
  context: Awaited<ReturnType<typeof launchExtension>>['context'],
  extensionId: string,
  focusPage: Page,
): Promise<string | undefined> {
  const response: unknown = await sendExtensionRuntimeMessage(
    context,
    extensionId,
    { type: 'GET_SESSION_STATE' },
    focusPage,
  );
  if (
    typeof response === 'object' &&
    response !== null &&
    'ok' in response &&
    response.ok === true &&
    'state' in response &&
    typeof (response as { state: { id?: string } }).state?.id === 'string'
  ) {
    return (response as { state: { id: string } }).state.id;
  }
  return undefined;
}

test('repeated sessions on the same page capture all collectors', async () => {
  const { baseUrl, server } = await startDiagnosticsServer();
  const launched = await launchExtension();
  const pageErrors: string[] = [];

  try {
    const page = await launched.context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`${baseUrl}/`);
    await page.bringToFront();

    await startRecordingOnPage(launched.context, launched.extensionId, page);
    await waitForCollectorsReady(launched.context, launched.extensionId, page);
    const sessionOne = await readSessionId(
      launched.context,
      launched.extensionId,
      page,
    );

    await page.click('#action-event');
    await page.click('#ui-issue');
    await page.click('#console-error');
    await page.click('#fetch-404');

    await expect
      .poll(async () =>
        readCount(
          launched.context,
          launched.extensionId,
          page,
          'GET_ACTION_LIST',
        ),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(async () =>
        readCount(
          launched.context,
          launched.extensionId,
          page,
          'GET_UI_ISSUE_LIST',
        ),
      )
      .toBe(1);
    await expect
      .poll(async () =>
        readCount(
          launched.context,
          launched.extensionId,
          page,
          'GET_CONSOLE_ISSUE_LIST',
        ),
      )
      .toBe(1);
    await expect
      .poll(async () =>
        readCount(
          launched.context,
          launched.extensionId,
          page,
          'GET_NETWORK_ISSUE_LIST',
        ),
      )
      .toBe(1);

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'STOP_SESSION' },
      page,
    );

    await startNewCaptureOnPage(launched.context, launched.extensionId, page);
    await waitForCollectorsReady(launched.context, launched.extensionId, page);
    const sessionTwo = await readSessionId(
      launched.context,
      launched.extensionId,
      page,
    );
    expect(sessionTwo).toBeTruthy();
    expect(sessionTwo).not.toBe(sessionOne);

    await expect
      .poll(async () =>
        readCount(
          launched.context,
          launched.extensionId,
          page,
          'GET_UI_ISSUE_LIST',
        ),
      )
      .toBe(0);
    await expect
      .poll(async () =>
        readCount(
          launched.context,
          launched.extensionId,
          page,
          'GET_CONSOLE_ISSUE_LIST',
        ),
      )
      .toBe(0);
    await expect
      .poll(async () =>
        readCount(
          launched.context,
          launched.extensionId,
          page,
          'GET_NETWORK_ISSUE_LIST',
        ),
      )
      .toBe(0);

    const actionsBeforeSessionTwoEvents = await readCount(
      launched.context,
      launched.extensionId,
      page,
      'GET_ACTION_LIST',
    );

    await page.click('#action-event');
    await expect
      .poll(async () =>
        readCount(
          launched.context,
          launched.extensionId,
          page,
          'GET_ACTION_LIST',
        ),
      )
      .toBe(actionsBeforeSessionTwoEvents + 1);

    await page.click('#ui-issue');
    await expect
      .poll(async () =>
        readCount(
          launched.context,
          launched.extensionId,
          page,
          'GET_UI_ISSUE_LIST',
        ),
      )
      .toBe(1);

    await page.click('#console-error');
    await expect
      .poll(async () =>
        readCount(
          launched.context,
          launched.extensionId,
          page,
          'GET_CONSOLE_ISSUE_LIST',
        ),
      )
      .toBe(1);

    await page.click('#xhr-error');
    await expect
      .poll(async () =>
        readCount(
          launched.context,
          launched.extensionId,
          page,
          'GET_CONSOLE_ISSUE_LIST',
        ),
      )
      .toBe(1);
    await expect
      .poll(async () =>
        readCount(
          launched.context,
          launched.extensionId,
          page,
          'GET_NETWORK_ISSUE_LIST',
        ),
      )
      .toBe(1);

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'PAUSE_SESSION' },
      page,
    );
    await page.click('#console-error');
    await page.waitForTimeout(400);
    expect(
      await readCount(
        launched.context,
        launched.extensionId,
        page,
        'GET_CONSOLE_ISSUE_LIST',
      ),
    ).toBe(1);

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'RESUME_SESSION' },
      page,
    );
    await waitForCollectorsReady(launched.context, launched.extensionId, page);
    await page.click('#console-error');
    await expect
      .poll(async () => {
        const response: unknown = await sendExtensionRuntimeMessage(
          launched.context,
          launched.extensionId,
          { type: 'GET_CONSOLE_ISSUE_LIST' },
          page,
        );
        if (
          typeof response !== 'object' ||
          response === null ||
          !('issues' in response) ||
          !Array.isArray((response as { issues: unknown[] }).issues) ||
          (response as { issues: unknown[] }).issues.length !== 1
        ) {
          return false;
        }
        const issue = (response as { issues: { occurrenceCount?: number }[] })
          .issues[0];
        return issue?.occurrenceCount === 2;
      })
      .toBe(true);

    expect(pageErrors).toEqual([]);
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
