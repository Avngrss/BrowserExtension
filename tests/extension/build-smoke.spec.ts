import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`Manifest field ${key} is not a string.`);
  }
  return value;
}

function readStringArray(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === 'string')
  ) {
    throw new Error(`${label} is not a string array.`);
  }
  return value;
}

test('production build is a Manifest V3 package without extra permissions', async () => {
  const requiredFiles = [
    'manifest.json',
    'background.js',
    'sidepanel.html',
    'options.html',
    'content-scripts/content.js',
    'content-scripts/console-bridge.js',
  ];

  for (const fileName of requiredFiles) {
    await access(path.join(extensionPath, fileName));
  }

  const manifestText = await readFile(
    path.join(extensionPath, 'manifest.json'),
    'utf8',
  );
  const parsed: unknown = JSON.parse(manifestText);
  if (!isRecord(parsed)) {
    throw new Error('Manifest is not an object.');
  }

  expect(parsed.manifest_version).toBe(3);
  expect(readString(parsed, 'name')).toBe('Bug Capture Assistant');
  expect(readString(parsed, 'description')).toBe(
    'Capture testing sessions and prepare structured evidence for bug reports.',
  );
  expect(readString(parsed, 'version')).toBe('0.1.0');
  expect(readStringArray(parsed.permissions, 'permissions').toSorted()).toEqual(
    ['notifications', 'scripting', 'sidePanel', 'storage', 'tabs'].toSorted(),
  );
  expect(
    readStringArray(parsed.host_permissions, 'host_permissions').toSorted(),
  ).toEqual(['<all_urls>', 'http://*/*', 'https://*/*'].toSorted());

  if (!isRecord(parsed.background)) {
    throw new Error('Background is missing.');
  }
  expect(readString(parsed.background, 'service_worker')).toBe('background.js');

  if (!isRecord(parsed.action)) {
    throw new Error('Action is missing.');
  }
  expect(parsed.action.default_popup).toBeUndefined();

  if (!isRecord(parsed.options_ui)) {
    throw new Error('Options page is missing.');
  }
  expect(readString(parsed.options_ui, 'page')).toBe('options.html');
  expect(parsed.options_ui.open_in_tab).toBe(true);

  if (!isRecord(parsed.side_panel)) {
    throw new Error('Side panel is missing.');
  }
  expect(readString(parsed.side_panel, 'default_path')).toBe('sidepanel.html');

  if (
    !Array.isArray(parsed.content_scripts) ||
    parsed.content_scripts.length !== 2
  ) {
    throw new Error('Expected isolated and MAIN-world content scripts.');
  }

  const mainBridge = parsed.content_scripts.find(
    (entry): entry is Record<string, unknown> =>
      isRecord(entry) && entry.world === 'MAIN',
  );
  if (mainBridge === undefined) {
    throw new Error('MAIN-world console bridge content script is missing.');
  }
  expect(readStringArray(mainBridge.matches, 'MAIN bridge matches')).toEqual([
    'http://*/*',
    'https://*/*',
  ]);
  expect(mainBridge.run_at).toBe('document_start');
  expect(readStringArray(mainBridge.js, 'MAIN bridge files')).toEqual([
    'content-scripts/console-bridge.js',
  ]);

  const isolatedScript = parsed.content_scripts.find(
    (entry): entry is Record<string, unknown> =>
      isRecord(entry) && entry.world !== 'MAIN',
  );
  if (isolatedScript === undefined) {
    throw new Error('Isolated content script is missing.');
  }
  expect(
    readStringArray(isolatedScript.matches, 'isolated content script matches'),
  ).toEqual(['http://*/*', 'https://*/*']);
  expect(
    readStringArray(isolatedScript.js, 'isolated content script files'),
  ).toEqual(['content-scripts/content.js']);
  expect(isolatedScript.css).toBeUndefined();

  const bridgeSource = await readFile(
    path.join(extensionPath, 'content-scripts/console-bridge.js'),
    'utf8',
  );
  expect(bridgeSource).not.toMatch(/\beval\s*\(/);
  expect(bridgeSource).not.toMatch(/\bnew\s+Function\b/);
  expect(bridgeSource).not.toMatch(/world\s*:\s*[`'"]MAIN[`'"]/);
});

async function launchExtension(): Promise<{
  context: BrowserContext;
  extensionId: string;
  userDataDir: string;
}> {
  const userDataDir = await mkdtemp(
    path.join(os.tmpdir(), 'bug-capture-assistant-'),
  );
  const extensionArg = extensionPath.replaceAll('\\', '/');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 360, height: 640 },
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

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  const clientWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

test('extension pages render in Chromium', async () => {
  const launched = await launchExtension();

  try {
    const sidePanel = await launched.context.newPage();
    await sidePanel.setViewportSize({ width: 320, height: 700 });
    await sidePanel.emulateMedia({ colorScheme: 'light' });
    await sidePanel.goto(
      `chrome-extension://${launched.extensionId}/sidepanel.html`,
    );
    await expect(sidePanel.getByText(/No activity yet/i)).toBeVisible();
    await expect(
      sidePanel.getByRole('button', { name: 'Start capture' }),
    ).toBeEnabled();
    await expect(sidePanel.getByLabel('Capture summary')).toBeVisible();
    await expectNoHorizontalOverflow(sidePanel);

    const optionsPromise = launched.context.waitForEvent('page');
    await sidePanel.getByRole('button', { name: 'Settings' }).click();
    const optionsPage = await optionsPromise;
    await expect(
      optionsPage.getByRole('heading', { name: 'Settings' }),
    ).toBeVisible();
    await expect(
      optionsPage.getByRole('heading', { name: 'Privacy' }),
    ).toBeVisible();

    const lightBackground = await sidePanel.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(lightBackground).toBe('rgb(248, 250, 252)');

    await sidePanel.emulateMedia({ colorScheme: 'dark' });
    const darkBackground = await sidePanel.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(darkBackground).toBe('rgb(2, 6, 23)');

    await sidePanel.setViewportSize({ width: 240, height: 700 });
    await expectNoHorizontalOverflow(sidePanel);

    const openSettings = sidePanel.getByRole('button', {
      name: 'Settings',
    });
    await openSettings.focus();
    await expect(openSettings).toBeFocused();
  } finally {
    await launched.context.close();
    await rm(launched.userDataDir, { recursive: true, force: true });
  }
});
