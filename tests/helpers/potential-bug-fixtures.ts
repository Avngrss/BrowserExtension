import type { CapturedAction } from '@/src/domain/action';
import type { ConsoleIssue } from '@/src/domain/console-issue';
import type { NetworkIssue } from '@/src/domain/network-issue';
import type {
  PotentialBug,
  PotentialBugPage,
} from '@/src/domain/potential-bug';
import type { UiIssue } from '@/src/domain/ui-issue';

export const SESSION_ID = 'session-1';

export const CHECKOUT_PAGE: PotentialBugPage = {
  url: 'https://shop.test/checkout',
  pathname: '/checkout',
};

export const CART_PAGE: PotentialBugPage = {
  url: 'https://shop.test/cart',
  pathname: '/cart',
};

export function sequentialIds(prefix = 'bug'): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `${prefix}-${next}`;
  };
}

export function clickAction(
  id: string,
  timestamp: number,
  label?: string,
  tagName = 'button',
): CapturedAction {
  return {
    id,
    sessionId: SESSION_ID,
    timestamp,
    url: 'https://shop.test/checkout',
    type: 'click',
    element:
      label === undefined ? { tagName } : { tagName, visibleText: label },
  };
}

export function navigationAction(
  id: string,
  timestamp: number,
  path: string,
): CapturedAction {
  return {
    id,
    sessionId: SESSION_ID,
    timestamp,
    url: `https://shop.test${path}`,
    type: 'navigation',
  };
}

export function uiIssue(id: string, overrides: Partial<UiIssue> = {}): UiIssue {
  return {
    id,
    sessionId: SESSION_ID,
    timestamp: 1_000,
    lastSeenAt: 1_000,
    ruleId: 'rule',
    ruleName: 'Alert',
    severity: 'error',
    url: 'https://shop.test/checkout',
    element: { tagName: 'div' },
    occurrenceCount: 1,
    disposition: 'unexpected',
    visibleMessage: 'Payment unavailable',
    ...overrides,
  };
}

export function consoleIssue(
  id: string,
  overrides: Partial<ConsoleIssue> = {},
): ConsoleIssue {
  return {
    id,
    sessionId: SESSION_ID,
    timestamp: 1_000,
    lastSeenAt: 1_000,
    category: 'console-error',
    message: 'Boom',
    url: 'https://shop.test/checkout',
    occurrenceCount: 1,
    disposition: 'unexpected',
    ...overrides,
  };
}

export function networkIssue(
  id: string,
  overrides: Partial<NetworkIssue> = {},
): NetworkIssue {
  return {
    id,
    sessionId: SESSION_ID,
    timestamp: 1_000,
    lastSeenAt: 1_000,
    source: 'fetch',
    category: 'http-error',
    method: 'POST',
    url: 'https://shop.test/api/pay',
    status: 500,
    occurrenceCount: 1,
    disposition: 'unexpected',
    ...overrides,
  };
}

export function potentialBug(
  id: string,
  overrides: Partial<PotentialBug> = {},
): PotentialBug {
  return {
    id,
    sessionId: SESSION_ID,
    createdAt: 1_000,
    lastDetectedAt: 1_000,
    source: 'automatic',
    page: CHECKOUT_PAGE,
    actions: [],
    issues: [],
    status: 'included',
    ...overrides,
  };
}
