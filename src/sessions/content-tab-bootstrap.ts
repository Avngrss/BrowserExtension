import {
  CONTENT_BOOTSTRAP_PONG,
  createContentBootstrapPing,
  isCompatibleBootstrapPong,
  type ContentBootstrapPongMessage,
} from '@/src/messaging/content-bootstrap-types';
import {
  readExtensionBuildVersion,
  readExtensionRuntimeId,
} from '@/src/utils/extension-build';
import { browser } from 'wxt/browser';

export type ContentBootstrapResult =
  | { ok: true }
  | {
      ok: false;
      code: 'CONTENT_BOOTSTRAP_FAILED' | 'UNSUPPORTED_TARGET_TAB';
      message: string;
    };

const ISOLATED_CONTENT_FILE = '/content-scripts/content.js';
const MAIN_BRIDGE_FILE = '/content-scripts/console-bridge.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePong(value: unknown): ContentBootstrapPongMessage | null {
  if (!isRecord(value) || value.type !== CONTENT_BOOTSTRAP_PONG) {
    return null;
  }
  if (
    typeof value.buildVersion !== 'string' ||
    typeof value.runtimeId !== 'string' ||
    typeof value.contentInstanceId !== 'string' ||
    typeof value.documentId !== 'string' ||
    value.protocolVersion !== 1
  ) {
    return null;
  }
  return value as ContentBootstrapPongMessage;
}

async function pingTab(
  tabId: number,
): Promise<ContentBootstrapPongMessage | null> {
  const buildVersion = readExtensionBuildVersion();
  const runtimeId = readExtensionRuntimeId();
  if (runtimeId.length === 0) {
    return null;
  }

  try {
    const response: unknown = await browser.tabs.sendMessage(
      tabId,
      createContentBootstrapPing({ buildVersion, runtimeId }),
    );
    const pong = parsePong(response);
    if (pong === null) {
      return null;
    }
    return isCompatibleBootstrapPong(pong, { buildVersion, runtimeId })
      ? pong
      : null;
  } catch {
    return null;
  }
}

async function injectScripts(tabId: number): Promise<boolean> {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: [MAIN_BRIDGE_FILE],
      world: 'MAIN',
    });
  } catch {
    return false;
  }

  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: [ISOLATED_CONTENT_FILE],
    });
  } catch {
    return false;
  }

  return true;
}

export async function ensureTargetTabContentBootstrap(
  tabId: number,
): Promise<ContentBootstrapResult> {
  let tabUrl: string | undefined;
  try {
    const tab = await browser.tabs.get(tabId);
    tabUrl = tab.url;
    if (
      tabUrl === undefined ||
      (!tabUrl.startsWith('http://') && !tabUrl.startsWith('https://'))
    ) {
      return {
        ok: false,
        code: 'UNSUPPORTED_TARGET_TAB',
        message: 'This browser page does not allow extension capture.',
      };
    }
  } catch {
    return {
      ok: false,
      code: 'UNSUPPORTED_TARGET_TAB',
      message: 'This browser page does not allow extension capture.',
    };
  }

  const existing = await pingTab(tabId);
  if (existing !== null) {
    return { ok: true };
  }

  const injected = await injectScripts(tabId);
  if (!injected) {
    return {
      ok: false,
      code: 'CONTENT_BOOTSTRAP_FAILED',
      message: 'Capture could not start on this page.',
    };
  }

  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const pong = await pingTab(tabId);
    if (pong !== null) {
      return { ok: true };
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  return {
    ok: false,
    code: 'CONTENT_BOOTSTRAP_FAILED',
    message: 'Capture could not start on this page.',
  };
}
