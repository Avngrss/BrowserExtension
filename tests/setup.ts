import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { hasBalancedSquareBrackets } from '@/src/ui/selector-validation';
import { extensionBrowserMock } from './helpers/mock-extension-browser';
import type { SessionSnapshot } from '@/src/domain/session';
import type { IssueMarkSessionData } from '@/src/domain/issue-mark';
import { actionClientMock } from './helpers/mock-action-client';
import { consoleIssueClientMock } from './helpers/mock-console-issue-client';
import { networkIssueClientMock } from './helpers/mock-network-issue-client';
import { uiIssueClientMock } from './helpers/mock-ui-issue-client';
import { issueDispositionClientMock } from './helpers/mock-issue-disposition-client';
import { uiRuleClientMock } from './helpers/mock-ui-rule-client';
import { sessionClientMock } from './helpers/mock-session-client';
import { screenshotEvidenceClientMock } from './helpers/mock-screenshot-evidence-client';
import { issueMarkClientMock } from './helpers/mock-issue-mark-client';
import { potentialBugClientMock } from './helpers/mock-potential-bug-client';

if (typeof globalThis.CSS === 'undefined') {
  Object.assign(globalThis, {
    CSS: { supports: () => false },
  });
}

if (typeof globalThis.CSS.supports !== 'function') {
  globalThis.CSS.supports = (property: string, value?: string): boolean => {
    let selector: string | null = null;
    if (property === 'selector' && typeof value === 'string') {
      selector = value.trim();
    } else if (property.startsWith('selector(') && property.endsWith(')')) {
      selector = property.slice('selector('.length, -1).trim();
    }
    if (selector === null || selector.length === 0) {
      return false;
    }
    if (!hasBalancedSquareBrackets(selector)) {
      return false;
    }
    if (selector.includes('>>')) {
      return false;
    }
    try {
      document.querySelector(selector);
      return true;
    } catch {
      return false;
    }
  };
}

vi.mock('@/src/utils/browser-client', () => {
  return {
    extensionBrowser: {
      getCurrentWindowId: () => extensionBrowserMock.getCurrentWindowId(),
      openOptionsPage: () => extensionBrowserMock.openOptionsPage(),
      activateTab: (tabId: number) => extensionBrowserMock.activateTab(tabId),
      get openSidePanel() {
        if (!extensionBrowserMock.sidePanelSupported) {
          return undefined;
        }

        return (windowId: number) =>
          extensionBrowserMock.openSidePanel(windowId);
      },
    },
  };
});

vi.mock('@/src/utils/session-client', () => {
  return {
    SESSION_COMMAND_FAILED_MESSAGE:
      'The session command could not be completed.',
    SESSION_SYNC_FAILED_MESSAGE: 'Could not load the current session state.',
    sessionClient: {
      getState: () => sessionClientMock.getState(),
      start: () => sessionClientMock.start(),
      pause: () => sessionClientMock.pause(),
      resume: () => sessionClientMock.resume(),
      stop: () => sessionClientMock.stop(),
      startNewCapture: () => sessionClientMock.startNewCapture(),
      deleteSession: () => sessionClientMock.deleteSession(),
      subscribe: (listener: (state: SessionSnapshot) => void) =>
        sessionClientMock.subscribe(listener),
      createStateUpdatedMessage: (state: SessionSnapshot) => ({
        type: 'SESSION_STATE_UPDATED',
        state,
        revision: 1,
      }),
    },
  };
});

vi.mock('@/src/utils/console-issue-client', () => {
  return {
    CONSOLE_ISSUE_SYNC_FAILED_MESSAGE:
      'Could not load captured console issues for this session.',
    consoleIssueClient: {
      getIssues: () => consoleIssueClientMock.getIssues(),
      subscribe: (
        listener: (
          issues: import('@/src/domain/console-issue').ConsoleIssue[],
        ) => void,
      ) => consoleIssueClientMock.subscribe(listener),
    },
  };
});

vi.mock('@/src/utils/ui-issue-client', () => {
  return {
    UI_ISSUE_SYNC_FAILED_MESSAGE:
      'Could not load captured UI issues for this session.',
    uiIssueClient: {
      getIssues: () => uiIssueClientMock.getIssues(),
      subscribe: (
        listener: (issues: import('@/src/domain/ui-issue').UiIssue[]) => void,
      ) => uiIssueClientMock.subscribe(listener),
    },
  };
});

vi.mock('@/src/utils/network-issue-client', () => {
  return {
    NETWORK_ISSUE_SYNC_FAILED_MESSAGE:
      'Could not load captured network issues for this session.',
    networkIssueClient: {
      getIssues: () => networkIssueClientMock.getIssues(),
      subscribe: (
        listener: (
          issues: import('@/src/domain/network-issue').NetworkIssue[],
        ) => void,
      ) => networkIssueClientMock.subscribe(listener),
    },
  };
});

vi.mock('@/src/utils/issue-disposition-client', () => {
  return {
    ISSUE_DISPOSITION_UPDATE_FAILED_MESSAGE:
      'Could not update the issue review disposition.',
    issueDispositionClient: {
      setIssueDisposition: (input: {
        category: 'ui' | 'console' | 'network';
        issueId: string;
        disposition: 'unexpected' | 'expected' | 'excluded';
      }) => issueDispositionClientMock.setIssueDisposition(input),
      setBulkDisposition: (input: {
        category: 'ui' | 'console' | 'network' | 'all';
        disposition: 'unexpected' | 'expected' | 'excluded';
      }) => issueDispositionClientMock.setBulkDisposition(input),
    },
  };
});

vi.mock('@/src/utils/ui-rule-client', () => {
  return {
    uiRuleClient: {
      getRules: () => uiRuleClientMock.getRules(),
      saveRule: (rule: import('@/src/domain/ui-rule').UiIssueRule) =>
        uiRuleClientMock.saveRule(rule),
      deleteRule: (ruleId: string) => uiRuleClientMock.deleteRule(ruleId),
      subscribe: (
        listener: (rules: import('@/src/domain/ui-rule').UiIssueRule[]) => void,
      ) => uiRuleClientMock.subscribe(listener),
    },
  };
});

vi.mock('@/src/utils/screenshot-evidence-client', () => {
  return {
    fetchScreenshotEvidenceList: () =>
      Promise.resolve(screenshotEvidenceClientMock.getEvidence()),
    deleteScreenshotEvidence: (screenshotId: string) => {
      const before = screenshotEvidenceClientMock.getEvidence().length;
      screenshotEvidenceClientMock.setEvidence(
        screenshotEvidenceClientMock
          .getEvidence()
          .filter((item) => item.id !== screenshotId),
      );
      return Promise.resolve(
        screenshotEvidenceClientMock.getEvidence().length < before,
      );
    },
  };
});

vi.mock('@/src/utils/issue-mark-client', () => {
  return {
    ISSUE_MARK_SYNC_FAILED_MESSAGE:
      'Could not load the marked issue for this session.',
    ISSUE_MARK_SAVE_FAILED_MESSAGE: 'Could not save the issue mark.',
    issueMarkClient: {
      getData: () => Promise.resolve(issueMarkClientMock.getData()),
      saveMark: () =>
        Promise.resolve({
          ok: true as const,
          data: issueMarkClientMock.getData(),
        }),
      setReportScope: () => Promise.resolve(issueMarkClientMock.getData()),
      setReportScopeWithoutMark: () =>
        Promise.resolve(issueMarkClientMock.getData()),
      subscribe: (listener: (data: IssueMarkSessionData) => void) =>
        issueMarkClientMock.subscribe(listener),
    },
  };
});

vi.mock('@/src/utils/potential-bug-client', () => {
  return {
    POTENTIAL_BUG_SYNC_FAILED_MESSAGE:
      'Could not load potential bugs for this session.',
    POTENTIAL_BUG_SAVE_FAILED_MESSAGE: 'Could not capture the bug.',
    potentialBugClient: {
      getBugs: () => potentialBugClientMock.getBugs(),
      captureBugNow: (input: { note?: string }) =>
        potentialBugClientMock.captureBugNow(input),
      setStatus: (
        bugId: string,
        status: import('@/src/domain/potential-bug').PotentialBugStatus,
      ) => potentialBugClientMock.setStatus(bugId, status),
      subscribe: (
        listener: (
          bugs: import('@/src/domain/potential-bug').PotentialBug[],
        ) => void,
      ) => potentialBugClientMock.subscribe(listener),
    },
  };
});

vi.mock('@/src/utils/action-client', () => {
  return {
    ACTION_SYNC_FAILED_MESSAGE:
      'Could not load captured actions for this session.',
    actionClient: {
      getActions: () => actionClientMock.getActions(),
      subscribe: (
        listener: (
          actions: import('@/src/domain/action').CapturedAction[],
        ) => void,
      ) => actionClientMock.subscribe(listener),
    },
  };
});

afterEach(() => {
  cleanup();
  potentialBugClientMock.reset();
});
