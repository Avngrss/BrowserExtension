/// <reference types="chrome-types" />

import { expect, test } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  launchExtension,
  sendExtensionRuntimeMessage,
  startNewCaptureOnPage,
  waitForCollectorsReady,
} from '../helpers/extension-playwright';
import { startDiagnosticsServer } from '../helpers/diagnostics-server';

test('starts capture on an already-open page via runtime bootstrap', async () => {
  const { baseUrl, server } = await startDiagnosticsServer();
  const launched = await launchExtension();
  const invalidatedErrors: string[] = [];

  try {
    const page = await launched.context.newPage();
    page.on('pageerror', (error) => {
      if (error.message.includes('Extension context invalidated')) {
        invalidatedErrors.push(error.message);
      }
    });

    const initialUrl = page.url();
    const navigation = page.goto(`${baseUrl}/`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('commit');

    const startResponse: unknown = await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'START_SESSION' },
      page,
    );
    expect(startResponse).toMatchObject({
      ok: true,
      state: { status: 'recording' },
    });

    await navigation;
    expect(page.url()).not.toBe(initialUrl);

    await waitForCollectorsReady(launched.context, launched.extensionId, page);

    await page.click('#action-event');
    await page.click('#ui-issue');
    await page.click('#console-error');
    await page.click('#fetch-404');

    await expect
      .poll(async () => {
        const actions: unknown = await sendExtensionRuntimeMessage(
          launched.context,
          launched.extensionId,
          { type: 'GET_ACTION_LIST' },
        );
        const ui: unknown = await sendExtensionRuntimeMessage(
          launched.context,
          launched.extensionId,
          { type: 'GET_UI_ISSUE_LIST' },
        );
        const consoleList: unknown = await sendExtensionRuntimeMessage(
          launched.context,
          launched.extensionId,
          { type: 'GET_CONSOLE_ISSUE_LIST' },
        );
        const network: unknown = await sendExtensionRuntimeMessage(
          launched.context,
          launched.extensionId,
          { type: 'GET_NETWORK_ISSUE_LIST' },
        );
        const actionOk =
          typeof actions === 'object' &&
          actions !== null &&
          'actions' in actions &&
          Array.isArray((actions as { actions: unknown[] }).actions) &&
          (actions as { actions: unknown[] }).actions.length >= 1;
        const uiOk =
          typeof ui === 'object' &&
          ui !== null &&
          'issues' in ui &&
          Array.isArray((ui as { issues: unknown[] }).issues) &&
          (ui as { issues: unknown[] }).issues.length >= 1;
        const consoleOk =
          typeof consoleList === 'object' &&
          consoleList !== null &&
          'issues' in consoleList &&
          Array.isArray((consoleList as { issues: unknown[] }).issues) &&
          (consoleList as { issues: unknown[] }).issues.length >= 1;
        const networkOk =
          typeof network === 'object' &&
          network !== null &&
          'issues' in network &&
          Array.isArray((network as { issues: unknown[] }).issues) &&
          (network as { issues: unknown[] }).issues.length >= 1;
        return actionOk && uiOk && consoleOk && networkOk;
      })
      .toBe(true);

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'STOP_SESSION' },
      page,
    );

    await startNewCaptureOnPage(launched.context, launched.extensionId, page);
    await waitForCollectorsReady(launched.context, launched.extensionId, page);

    await page.click('#xhr-error');
    await expect
      .poll(async () => {
        const network: unknown = await sendExtensionRuntimeMessage(
          launched.context,
          launched.extensionId,
          { type: 'GET_NETWORK_ISSUE_LIST' },
        );
        return (
          typeof network === 'object' &&
          network !== null &&
          'issues' in network &&
          Array.isArray((network as { issues: unknown[] }).issues) &&
          (network as { issues: unknown[] }).issues.length >= 1
        );
      })
      .toBe(true);

    expect(invalidatedErrors).toEqual([]);
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
