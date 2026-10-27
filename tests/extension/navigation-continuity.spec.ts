/// <reference types="chrome-types" />

import { expect, test } from '@playwright/test';
import {
  cleanupExtensionLaunch,
  expectCapturingThisTab,
  launchExtension,
  openSidePanelPage,
  sendExtensionRuntimeMessage,
  startRecordingOnPage,
  waitForCollectorsReady,
} from '../helpers/extension-playwright';
import { startDiagnosticsServer } from '../helpers/diagnostics-server';

test('navigation continuity keeps collectors active', async () => {
  const { baseUrl, server } = await startDiagnosticsServer();
  const launched = await launchExtension();

  try {
    const page = await launched.context.newPage();
    await page.goto(`${baseUrl}/`);
    await page.bringToFront();

    const sidePanel = await openSidePanelPage(
      launched.context,
      launched.extensionId,
    );
    await startRecordingOnPage(launched.context, launched.extensionId, page);
    await waitForCollectorsReady(launched.context, launched.extensionId, page);
    await expectCapturingThisTab(sidePanel, page);

    await page.click('#history-nav');
    await expect(
      sidePanel.getByText('Page title: Diagnostics SPA route'),
    ).toBeVisible({
      timeout: 15_000,
    });

    await page.click('#action-event');
    await page.click('#console-error');
    await page.click('#fetch-404');

    await expect
      .poll(async () => {
        const response: unknown = await sendExtensionRuntimeMessage(
          launched.context,
          launched.extensionId,
          { type: 'GET_ACTION_LIST' },
          page,
        );
        return (
          typeof response === 'object' &&
          response !== null &&
          'actions' in response &&
          Array.isArray((response as { actions: unknown[] }).actions) &&
          (response as { actions: unknown[] }).actions.length >= 1
        );
      })
      .toBe(true);

    await page.goto(`${baseUrl}/page-two`);
    await waitForCollectorsReady(launched.context, launched.extensionId, page);
    await expect(sidePanel.getByText('Page title: Page two')).toBeVisible({
      timeout: 15_000,
    });

    await page.click('#ui-issue');
    await page.click('#console-error');
    await page.click('#xhr-error');

    await expect
      .poll(async () => {
        const ui: unknown = await sendExtensionRuntimeMessage(
          launched.context,
          launched.extensionId,
          { type: 'GET_UI_ISSUE_LIST' },
          page,
        );
        const consoleList: unknown = await sendExtensionRuntimeMessage(
          launched.context,
          launched.extensionId,
          { type: 'GET_CONSOLE_ISSUE_LIST' },
          page,
        );
        const network: unknown = await sendExtensionRuntimeMessage(
          launched.context,
          launched.extensionId,
          { type: 'GET_NETWORK_ISSUE_LIST' },
          page,
        );
        const uiCount =
          typeof ui === 'object' &&
          ui !== null &&
          'issues' in ui &&
          Array.isArray((ui as { issues: unknown[] }).issues)
            ? (ui as { issues: unknown[] }).issues.length
            : 0;
        const consoleCount =
          typeof consoleList === 'object' &&
          consoleList !== null &&
          'issues' in consoleList &&
          Array.isArray((consoleList as { issues: unknown[] }).issues)
            ? (consoleList as { issues: unknown[] }).issues.length
            : 0;
        const networkCount =
          typeof network === 'object' &&
          network !== null &&
          'issues' in network &&
          Array.isArray((network as { issues: unknown[] }).issues)
            ? (network as { issues: unknown[] }).issues.length
            : 0;
        return uiCount >= 1 && consoleCount >= 2 && networkCount >= 2;
      })
      .toBe(true);
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
