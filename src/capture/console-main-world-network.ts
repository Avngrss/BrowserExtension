import type {
  NetworkBridgeIssueCategory,
  NetworkBridgeIssueSource,
} from '@/src/capture/console-bridge-constants';
import {
  MAX_NETWORK_FAILURE_MESSAGE_LENGTH,
  MAX_NETWORK_STATUS_TEXT_LENGTH,
  MAX_NETWORK_URL_LENGTH,
} from '@/src/network/network-limits';

const FETCH_FAILURE_MESSAGE = 'Fetch request failed';
const XHR_NETWORK_FAILURE_MESSAGE = 'Network request failed';
const XHR_TIMEOUT_MESSAGE = 'Request timed out';
const XHR_ABORTED_MESSAGE = 'Request aborted';

type NetworkEmitPayload = {
  source: NetworkBridgeIssueSource;
  category: NetworkBridgeIssueCategory;
  method: string;
  requestUrl: string;
  status?: number;
  statusText?: string;
  durationMs?: number;
  failureMessage?: string;
};

type BridgeActiveGetter = () => boolean;

type XhrMeta = {
  method: string;
  requestUrl: string;
  startMs: number;
  reported: boolean;
};

let networkInstalled = false;
let originalFetch: typeof fetch | undefined;
let originalXhrOpen: typeof XMLHttpRequest.prototype.open | undefined;
let originalXhrSend: typeof XMLHttpRequest.prototype.send | undefined;
const xhrMetadata = new WeakMap<XMLHttpRequest, XhrMeta>();
let emitNetworkIssue: ((payload: NetworkEmitPayload) => void) | undefined;
let isBridgeActive: BridgeActiveGetter = () => false;

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
}

function resolveRequestUrl(rawUrl: string): string {
  try {
    return truncateText(
      new URL(rawUrl, window.location.href).toString(),
      MAX_NETWORK_URL_LENGTH,
    );
  } catch {
    return truncateText(rawUrl, MAX_NETWORK_URL_LENGTH);
  }
}

function normalizeMethod(method: string): string {
  return truncateText(method.toUpperCase(), 20);
}

function resolveFetchMethod(
  input: RequestInfo | URL,
  init?: RequestInit,
): string {
  if (init?.method !== undefined) {
    return normalizeMethod(init.method);
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return normalizeMethod(input.method);
  }
  return 'GET';
}

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return resolveRequestUrl(input);
  }
  if (input instanceof URL) {
    return resolveRequestUrl(input.toString());
  }
  return resolveRequestUrl(input.url);
}

function postNetworkIssue(payload: NetworkEmitPayload): void {
  emitNetworkIssue?.(payload);
}

function finalizeXhr(
  xhr: XMLHttpRequest,
  eventType: 'load' | 'error' | 'timeout' | 'abort',
): void {
  const meta = xhrMetadata.get(xhr);
  if (meta === undefined || meta.reported) {
    return;
  }
  if (!isBridgeActive()) {
    return;
  }

  const durationMs = Math.max(0, Date.now() - meta.startMs);

  if (eventType === 'load') {
    const status = xhr.status;
    if (status >= 400 && status <= 599) {
      meta.reported = true;
      postNetworkIssue({
        source: 'xhr',
        category: 'http-error',
        method: meta.method,
        requestUrl: meta.requestUrl,
        status,
        statusText: truncateText(
          xhr.statusText,
          MAX_NETWORK_STATUS_TEXT_LENGTH,
        ),
        durationMs,
      });
    }
    return;
  }

  meta.reported = true;
  if (eventType === 'timeout') {
    postNetworkIssue({
      source: 'xhr',
      category: 'timeout',
      method: meta.method,
      requestUrl: meta.requestUrl,
      durationMs,
      failureMessage: truncateText(
        XHR_TIMEOUT_MESSAGE,
        MAX_NETWORK_FAILURE_MESSAGE_LENGTH,
      ),
    });
    return;
  }
  if (eventType === 'abort') {
    postNetworkIssue({
      source: 'xhr',
      category: 'aborted',
      method: meta.method,
      requestUrl: meta.requestUrl,
      durationMs,
      failureMessage: truncateText(
        XHR_ABORTED_MESSAGE,
        MAX_NETWORK_FAILURE_MESSAGE_LENGTH,
      ),
    });
    return;
  }

  postNetworkIssue({
    source: 'xhr',
    category: 'network-failure',
    method: meta.method,
    requestUrl: meta.requestUrl,
    durationMs,
    failureMessage: truncateText(
      XHR_NETWORK_FAILURE_MESSAGE,
      MAX_NETWORK_FAILURE_MESSAGE_LENGTH,
    ),
  });
}

function attachXhrListeners(xhr: XMLHttpRequest): void {
  xhr.addEventListener('load', () => {
    finalizeXhr(xhr, 'load');
  });
  xhr.addEventListener('error', () => {
    finalizeXhr(xhr, 'error');
  });
  xhr.addEventListener('timeout', () => {
    finalizeXhr(xhr, 'timeout');
  });
  xhr.addEventListener('abort', () => {
    finalizeXhr(xhr, 'abort');
  });
}

export function installMainWorldNetworkMonitoring(options: {
  isActive: BridgeActiveGetter;
  emit: (payload: NetworkEmitPayload) => void;
}): void {
  if (networkInstalled) {
    isBridgeActive = options.isActive;
    emitNetworkIssue = options.emit;
    return;
  }

  networkInstalled = true;
  isBridgeActive = options.isActive;
  emitNetworkIssue = options.emit;

  originalFetch = window.fetch.bind(window);
  window.fetch = function fetchWrapper(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const method = resolveFetchMethod(input, init);
    const requestUrl = resolveFetchUrl(input);
    const startMs = Date.now();
    const promise = originalFetch!(input, init);

    return promise.then(
      (response) => {
        if (isBridgeActive()) {
          const durationMs = Math.max(0, Date.now() - startMs);
          if (response.status >= 400 && response.status <= 599) {
            postNetworkIssue({
              source: 'fetch',
              category: 'http-error',
              method,
              requestUrl,
              status: response.status,
              statusText: truncateText(
                response.statusText,
                MAX_NETWORK_STATUS_TEXT_LENGTH,
              ),
              durationMs,
            });
          }
        }
        return response;
      },
      (reason) => {
        if (isBridgeActive()) {
          const durationMs = Math.max(0, Date.now() - startMs);
          postNetworkIssue({
            source: 'fetch',
            category: 'network-failure',
            method,
            requestUrl,
            durationMs,
            failureMessage: truncateText(
              FETCH_FAILURE_MESSAGE,
              MAX_NETWORK_FAILURE_MESSAGE_LENGTH,
            ),
          });
        }
        throw reason;
      },
    );
  };

  // eslint-disable-next-line @typescript-eslint/unbound-method -- preserve native XHR.open
  originalXhrOpen = XMLHttpRequest.prototype.open;
  const openWrapper = function openWrapper(
    this: XMLHttpRequest,
    ...args: Parameters<typeof XMLHttpRequest.prototype.open>
  ): void {
    const urlArg = args[1];
    const urlString = typeof urlArg === 'string' ? urlArg : urlArg.toString();
    xhrMetadata.set(this, {
      method: normalizeMethod(String(args[0])),
      requestUrl: resolveRequestUrl(urlString),
      startMs: 0,
      reported: false,
    });
    return originalXhrOpen!.apply(this, args);
  };
  XMLHttpRequest.prototype.open =
    openWrapper as typeof XMLHttpRequest.prototype.open;

  // eslint-disable-next-line @typescript-eslint/unbound-method -- preserve native XHR.send
  originalXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function sendWrapper(
    ...args: Parameters<typeof XMLHttpRequest.prototype.send>
  ): void {
    const meta = xhrMetadata.get(this);
    if (meta !== undefined) {
      meta.startMs = Date.now();
      attachXhrListeners(this);
    }
    return originalXhrSend!.apply(this, args);
  };
}

export function isMainWorldNetworkMonitoringInstalledForTests(): boolean {
  return networkInstalled;
}

export function teardownMainWorldNetworkMonitoringForTests(): void {
  if (!networkInstalled) {
    return;
  }
  if (originalFetch !== undefined) {
    window.fetch = originalFetch;
  }
  if (originalXhrOpen !== undefined) {
    XMLHttpRequest.prototype.open = originalXhrOpen;
  }
  if (originalXhrSend !== undefined) {
    XMLHttpRequest.prototype.send = originalXhrSend;
  }
  networkInstalled = false;
  originalFetch = undefined;
  originalXhrOpen = undefined;
  originalXhrSend = undefined;
  emitNetworkIssue = undefined;
  isBridgeActive = () => false;
}

export function emitNetworkIssueForTests(payload: NetworkEmitPayload): void {
  postNetworkIssue(payload);
}
