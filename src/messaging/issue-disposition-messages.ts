import type { ConsoleIssueStore } from '@/src/console/console-issue-store';
import {
  parseIssueDisposition,
  parseIssueReviewCategory,
} from '@/src/domain/issue-disposition';
import type { NetworkIssueStore } from '@/src/network/network-issue-store';
import type { UiIssueStore } from '@/src/ui/ui-issue-store';
import {
  SET_BULK_ISSUE_DISPOSITION,
  SET_ISSUE_DISPOSITION,
  type IssueDispositionMutationResponse,
  type IssueDispositionRequestMessage,
} from '@/src/messaging/issue-disposition-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isIssueDispositionRequestMessage(
  message: unknown,
): message is IssueDispositionRequestMessage {
  if (!isRecord(message) || typeof message.type !== 'string') {
    return false;
  }

  if (message.type === SET_ISSUE_DISPOSITION) {
    return (
      parseIssueReviewCategory(message.category) !== null &&
      typeof message.issueId === 'string' &&
      message.issueId.length > 0 &&
      parseIssueDisposition(message.disposition) !== null
    );
  }

  if (message.type === SET_BULK_ISSUE_DISPOSITION) {
    const category =
      message.category === 'all'
        ? 'all'
        : parseIssueReviewCategory(message.category);
    return (
      category !== null && parseIssueDisposition(message.disposition) !== null
    );
  }

  return false;
}

type IssueStores = {
  consoleIssueStore: ConsoleIssueStore;
  networkIssueStore: NetworkIssueStore;
  uiIssueStore: UiIssueStore;
};

export type IssueDispositionMutationTargets = {
  consoleUpdated: boolean;
  networkUpdated: boolean;
  uiUpdated: boolean;
};

export async function handleIssueDispositionRequestMessage(
  message: IssueDispositionRequestMessage,
  stores: IssueStores,
): Promise<{
  response: IssueDispositionMutationResponse;
  targets: IssueDispositionMutationTargets;
}> {
  const emptyTargets: IssueDispositionMutationTargets = {
    consoleUpdated: false,
    networkUpdated: false,
    uiUpdated: false,
  };

  if (message.type === SET_ISSUE_DISPOSITION) {
    const disposition = parseIssueDisposition(message.disposition);
    if (disposition === null) {
      return {
        response: {
          ok: false,
          error: {
            code: 'INVALID_DISPOSITION',
            message: 'The requested disposition is invalid.',
          },
        },
        targets: emptyTargets,
      };
    }

    if (message.category === 'console') {
      const response = await stores.consoleIssueStore.setIssueDisposition(
        message.issueId,
        disposition,
      );
      return {
        response: response.ok ? { ok: true } : response,
        targets: { ...emptyTargets, consoleUpdated: response.ok },
      };
    }
    if (message.category === 'network') {
      const response = await stores.networkIssueStore.setIssueDisposition(
        message.issueId,
        disposition,
      );
      return {
        response: response.ok ? { ok: true } : response,
        targets: { ...emptyTargets, networkUpdated: response.ok },
      };
    }

    const response = await stores.uiIssueStore.setIssueDisposition(
      message.issueId,
      disposition,
    );
    return {
      response: response.ok ? { ok: true } : response,
      targets: { ...emptyTargets, uiUpdated: response.ok },
    };
  }

  const disposition = parseIssueDisposition(message.disposition);
  if (disposition === null) {
    return {
      response: {
        ok: false,
        error: {
          code: 'INVALID_DISPOSITION',
          message: 'The requested disposition is invalid.',
        },
      },
      targets: emptyTargets,
    };
  }

  if (message.category === 'all') {
    const [consoleResponse, networkResponse, uiResponse] = await Promise.all([
      stores.consoleIssueStore.setAllIssueDispositions(disposition),
      stores.networkIssueStore.setAllIssueDispositions(disposition),
      stores.uiIssueStore.setAllIssueDispositions(disposition),
    ]);

    if (!consoleResponse.ok) {
      return { response: consoleResponse, targets: emptyTargets };
    }
    if (!networkResponse.ok) {
      return { response: networkResponse, targets: emptyTargets };
    }
    if (!uiResponse.ok) {
      return { response: uiResponse, targets: emptyTargets };
    }

    return {
      response: { ok: true },
      targets: {
        consoleUpdated: true,
        networkUpdated: true,
        uiUpdated: true,
      },
    };
  }

  if (message.category === 'console') {
    const response =
      await stores.consoleIssueStore.setAllIssueDispositions(disposition);
    return {
      response: response.ok ? { ok: true } : response,
      targets: { ...emptyTargets, consoleUpdated: response.ok },
    };
  }
  if (message.category === 'network') {
    const response =
      await stores.networkIssueStore.setAllIssueDispositions(disposition);
    return {
      response: response.ok ? { ok: true } : response,
      targets: { ...emptyTargets, networkUpdated: response.ok },
    };
  }

  const response =
    await stores.uiIssueStore.setAllIssueDispositions(disposition);
  return {
    response: response.ok ? { ok: true } : response,
    targets: { ...emptyTargets, uiUpdated: response.ok },
  };
}

export function shouldBroadcastIssueDispositionUpdate(
  message: unknown,
  response: unknown,
): response is { ok: true } {
  return (
    isIssueDispositionRequestMessage(message) &&
    typeof response === 'object' &&
    response !== null &&
    'ok' in response &&
    (response as { ok: boolean }).ok === true
  );
}

export function issueDispositionBroadcastTargetsForMessage(
  message: unknown,
): IssueDispositionMutationTargets | null {
  if (!isIssueDispositionRequestMessage(message)) {
    return null;
  }
  return getIssueDispositionBroadcastTargets(message);
}

export function getIssueDispositionBroadcastTargets(
  message: IssueDispositionRequestMessage,
): IssueDispositionMutationTargets {
  if (message.type === SET_ISSUE_DISPOSITION) {
    return {
      consoleUpdated: message.category === 'console',
      networkUpdated: message.category === 'network',
      uiUpdated: message.category === 'ui',
    };
  }

  if (message.category === 'all') {
    return {
      consoleUpdated: true,
      networkUpdated: true,
      uiUpdated: true,
    };
  }

  return {
    consoleUpdated: message.category === 'console',
    networkUpdated: message.category === 'network',
    uiUpdated: message.category === 'ui',
  };
}

export function rejectInvalidIssueDispositionMessage(
  message: unknown,
): IssueDispositionMutationResponse | undefined {
  if (!isRecord(message) || typeof message.type !== 'string') {
    return undefined;
  }

  if (
    message.type !== SET_ISSUE_DISPOSITION &&
    message.type !== SET_BULK_ISSUE_DISPOSITION
  ) {
    return undefined;
  }

  if (isIssueDispositionRequestMessage(message)) {
    return undefined;
  }

  if (message.type === SET_ISSUE_DISPOSITION) {
    if (parseIssueReviewCategory(message.category) === null) {
      return {
        ok: false,
        error: {
          code: 'INVALID_CATEGORY',
          message: 'The requested issue category is invalid.',
        },
      };
    }
    if (typeof message.issueId !== 'string' || message.issueId.length === 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_ISSUE_ID',
          message: 'The requested issue id is invalid.',
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'INVALID_DISPOSITION',
        message: 'The requested disposition is invalid.',
      },
    };
  }

  const category =
    message.category === 'all'
      ? 'all'
      : parseIssueReviewCategory(message.category);
  if (category === null) {
    return {
      ok: false,
      error: {
        code: 'INVALID_CATEGORY',
        message: 'The requested issue category is invalid.',
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'INVALID_DISPOSITION',
      message: 'The requested disposition is invalid.',
    },
  };
}
