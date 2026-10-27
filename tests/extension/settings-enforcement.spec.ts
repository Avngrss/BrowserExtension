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
const EXTENSION_SETTINGS_STORAGE_KEY = 'extensionSettings.v1';
const DEFAULT_EXTENSION_SETTINGS = {
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

test('settings disable console collection without blocking readiness', async () => {
  const { baseUrl, server } = await startDiagnosticsServer();
  const launched = await launchExtension();

  try {
    const page = await launched.context.newPage();
    await page.goto(`${baseUrl}/`);
    await page.bringToFront();

    const bridgePage = await launched.context.newPage();
    await bridgePage.goto(
      `chrome-extension://${launched.extensionId}/sidepanel.html`,
    );
    await bridgePage.evaluate(
      ([key, settings]) => {
        return chrome.storage.local.set({
          [key]: {
            ...settings,
            capture: {
              ...settings.capture,
              captureConsoleErrors: false,
            },
          },
        });
      },
      [EXTENSION_SETTINGS_STORAGE_KEY, DEFAULT_EXTENSION_SETTINGS] as const,
    );
    await bridgePage.close();

    await startRecordingOnPage(launched.context, launched.extensionId, page);
    await waitForCollectorsReady(launched.context, launched.extensionId, page);

    await page.click('#action-event');
    await page.click('#ui-issue');
    await page.click('#console-error');
    await page.click('#fetch-404');

    await expect
      .poll(async () => {
        const consoleList: unknown = await sendExtensionRuntimeMessage(
          launched.context,
          launched.extensionId,
          { type: 'GET_CONSOLE_ISSUE_LIST' },
          page,
        );
        return (
          typeof consoleList === 'object' &&
          consoleList !== null &&
          'issues' in consoleList &&
          Array.isArray((consoleList as { issues: unknown[] }).issues) &&
          (consoleList as { issues: unknown[] }).issues.length === 0
        );
      })
      .toBe(true);

    await expect
      .poll(async () => {
        const ui: unknown = await sendExtensionRuntimeMessage(
          launched.context,
          launched.extensionId,
          { type: 'GET_UI_ISSUE_LIST' },
          page,
        );
        return (
          typeof ui === 'object' &&
          ui !== null &&
          'issues' in ui &&
          Array.isArray((ui as { issues: unknown[] }).issues) &&
          (ui as { issues: unknown[] }).issues.length >= 1
        );
      })
      .toBe(true);

    await sendExtensionRuntimeMessage(
      launched.context,
      launched.extensionId,
      { type: 'STOP_SESSION' },
      page,
    );

    const bridgePageTwo = await launched.context.newPage();
    await bridgePageTwo.goto(
      `chrome-extension://${launched.extensionId}/sidepanel.html`,
    );
    await bridgePageTwo.evaluate(
      ([key, settings]) => {
        return chrome.storage.local.set({
          [key]: {
            ...settings,
            capture: {
              ...settings.capture,
              captureConsoleErrors: true,
            },
          },
        });
      },
      [EXTENSION_SETTINGS_STORAGE_KEY, DEFAULT_EXTENSION_SETTINGS] as const,
    );
    await bridgePageTwo.close();

    await startNewCaptureOnPage(launched.context, launched.extensionId, page);
    await waitForCollectorsReady(launched.context, launched.extensionId, page);
    await page.click('#console-error');

    await expect
      .poll(async () => {
        const consoleList: unknown = await sendExtensionRuntimeMessage(
          launched.context,
          launched.extensionId,
          { type: 'GET_CONSOLE_ISSUE_LIST' },
          page,
        );
        return (
          typeof consoleList === 'object' &&
          consoleList !== null &&
          'issues' in consoleList &&
          Array.isArray((consoleList as { issues: unknown[] }).issues) &&
          (consoleList as { issues: unknown[] }).issues.length >= 1
        );
      })
      .toBe(true);
  } finally {
    server.close();
    await cleanupExtensionLaunch(launched);
  }
});
