/// <reference types="chrome-types" />

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
const CUSTOM_RULE_NAME = 'Generic alert';

async function launchExtension(): Promise<{
  context: BrowserContext;
  extensionId: string;
  userDataDir: string;
}> {
  const userDataDir = await mkdtemp(
    path.join(os.tmpdir(), 'bug-capture-ui-rules-options-'),
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

async function openOptionsPage(
  context: BrowserContext,
  extensionId: string,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  return page;
}

async function expandAdvancedUiRules(page: Page): Promise<void> {
  const details = page
    .getByText('Advanced UI issue rules')
    .locator('xpath=ancestor::details[1]');
  if ((await details.getAttribute('open')) === null) {
    await page.getByText('Advanced UI issue rules').click();
  }
  await expect(
    page.getByRole('heading', { name: 'UI issue rules', exact: true }),
  ).toBeVisible();
}

function rulesList(page: Page) {
  return page
    .getByRole('heading', { name: 'UI issue rules', exact: true })
    .locator('xpath=ancestor::section[1]//ul');
}

async function assertOptionsPageHealthy(page: Page): Promise<void> {
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expandAdvancedUiRules(page);
}

test('manages UI issue rules on the Options page', async () => {
  const launched = await launchExtension();
  const pageErrors: string[] = [];

  try {
    const page = await openOptionsPage(launched.context, launched.extensionId);
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await assertOptionsPageHealthy(page);
    await expect(page.getByText('Alert role', { exact: true })).toBeVisible();
    await expect(page.getByText('Invalid field')).toBeVisible();
    await expect(page.getByText('Test error message')).toBeVisible();
    await expect(page.getByText('QA error message')).toBeVisible();
    await expect(rulesList(page).getByRole('listitem')).toHaveCount(4);

    await page.getByLabel('Name').fill(CUSTOM_RULE_NAME);
    await page.getByLabel('CSS selector').fill('[role="alert"]');
    await page
      .locator('form')
      .getByRole('button', { name: 'Add rule' })
      .click();

    await expect(page.getByText(CUSTOM_RULE_NAME)).toBeVisible();
    await expect(rulesList(page).getByRole('listitem')).toHaveCount(5);
    await assertOptionsPageHealthy(page);

    await page.reload();
    await assertOptionsPageHealthy(page);
    await expect(page.getByText(CUSTOM_RULE_NAME)).toBeVisible();

    const customRule = rulesList(page)
      .getByRole('listitem')
      .filter({ hasText: CUSTOM_RULE_NAME });
    await customRule.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('CSS selector').fill('.error-message');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(customRule.getByText('.error-message')).toBeVisible();
    await assertOptionsPageHealthy(page);

    const enabledToggle = customRule.getByRole('checkbox', {
      name: `Enabled rule ${CUSTOM_RULE_NAME}`,
    });
    await enabledToggle.click();
    await expect
      .poll(async () => enabledToggle.isChecked(), { timeout: 10_000 })
      .toBe(false);
    await enabledToggle.click();
    await expect
      .poll(async () => enabledToggle.isChecked(), { timeout: 10_000 })
      .toBe(true);
    await assertOptionsPageHealthy(page);

    await customRule.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(CUSTOM_RULE_NAME)).not.toBeVisible();
    await expect(rulesList(page).getByRole('listitem')).toHaveCount(4);
    await assertOptionsPageHealthy(page);

    await page.getByLabel('CSS selector').fill('[role="alert"');
    await page
      .locator('form')
      .getByRole('button', { name: 'Add rule' })
      .click();
    await expect(page.getByText('Enter a valid CSS selector.')).toBeVisible();
    await assertOptionsPageHealthy(page);

    expect(pageErrors).toEqual([]);
  } finally {
    await launched.context.close();
    await rm(launched.userDataDir, { recursive: true, force: true });
  }
});
