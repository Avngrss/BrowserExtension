import type { UiIssue, UiIssueSubmissionPayload } from '@/src/domain/ui-issue';
import type { IssueDisposition } from '@/src/domain/issue-disposition';
import {
  setAllStoredIssueDispositions,
  setStoredIssueDisposition,
  type IssueDispositionStoreResult,
} from '@/src/issues/issue-disposition-store-ops';
import { buildUiIssueFingerprint } from '@/src/ui/ui-issue-fingerprint';
import { MAX_STORED_UI_ISSUES } from '@/src/ui/ui-issue-limits';
import {
  parseUiIssueList,
  parseUiIssueSubmissionPayload,
} from '@/src/ui/ui-issue-validation';
import type { UiIssueStorageAdapter } from '@/src/ui/ui-issue-storage';
import type { UiRuleStore } from '@/src/ui/ui-rule-store';
import type { NewUniqueIssueNotifier } from '@/src/domain/new-unique-issue';
import type { SessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';

export type UiIssueListResponse =
  | { ok: true; issues: UiIssue[] }
  | {
      ok: false;
      error: {
        code:
          | 'STORAGE_ERROR'
          | 'UI_ISSUE_LIMIT_REACHED'
          | 'INVALID_UI_ISSUE'
          | 'STALE_UI_ISSUE';
        message: string;
      };
    };

export type UiIssueDispositionResponse = IssueDispositionStoreResult<UiIssue>;

export type UiIssueStoreDependencies = {
  getSessionState: () => SessionSnapshot;
  createIssueId: () => string;
  ruleStore: UiRuleStore;
  getMaxStoredIssues?: () => number;
  onNewUniqueIssue?: NewUniqueIssueNotifier;
};

export class UiIssueStore {
  private readonly ready: Promise<void>;
  private issues: UiIssue[] = [];
  private lastPersisted: UiIssue[] = [];
  private readonly fingerprints = new Map<string, string>();

  constructor(
    private readonly storage: UiIssueStorageAdapter,
    private readonly deps: UiIssueStoreDependencies,
  ) {
    this.ready = this.restoreFromStorage();
  }

  waitUntilReady(): Promise<void> {
    return this.ready;
  }

  getIssues(): UiIssue[] {
    return [...this.issues];
  }

  private rebuildFingerprints(): void {
    this.fingerprints.clear();
    for (const issue of this.issues) {
      this.fingerprints.set(
        issue.id,
        buildUiIssueFingerprint({
          ruleId: issue.ruleId,
          url: issue.url,
          element: issue.element,
          visibleMessage: issue.visibleMessage,
        }),
      );
    }
  }

  private async restoreFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.read();
      if (stored === undefined || stored === null) {
        this.issues = [];
        this.lastPersisted = [];
        this.fingerprints.clear();
        return;
      }

      const parsed = parseUiIssueList(stored);
      if (parsed === null) {
        await this.storage.remove();
        this.issues = [];
        this.lastPersisted = [];
        this.fingerprints.clear();
        return;
      }

      this.issues = parsed.slice(0, this.getMaxStoredIssues());
      this.lastPersisted = [...this.issues];
      this.rebuildFingerprints();
    } catch {
      this.issues = [];
      this.lastPersisted = [];
      this.fingerprints.clear();
    }
  }

  async clearIssues(): Promise<void> {
    await this.ready;
    this.issues = [];
    this.fingerprints.clear();
    try {
      await this.storage.remove();
      this.lastPersisted = [];
    } catch {
      this.issues = [...this.lastPersisted];
      this.rebuildFingerprints();
      throw new Error('UI issue storage write failed.');
    }
  }

  async getIssueList(): Promise<UiIssueListResponse> {
    await this.ready;
    return { ok: true, issues: this.getIssues() };
  }

  async setIssueDisposition(
    issueId: string,
    disposition: IssueDisposition,
  ): Promise<UiIssueDispositionResponse> {
    await this.ready;
    return setStoredIssueDisposition(
      {
        getSessionState: () => this.deps.getSessionState(),
        getIssues: () => this.issues,
        setIssues: (issues) => {
          this.issues = issues;
        },
        getLastPersisted: () => this.lastPersisted,
        setLastPersisted: (issues) => {
          this.lastPersisted = issues;
        },
        write: (issues) => this.storage.write(issues),
      },
      issueId,
      disposition,
    );
  }

  async setAllIssueDispositions(
    disposition: IssueDisposition,
  ): Promise<UiIssueDispositionResponse> {
    await this.ready;
    return setAllStoredIssueDispositions(
      {
        getSessionState: () => this.deps.getSessionState(),
        getIssues: () => this.issues,
        setIssues: (issues) => {
          this.issues = issues;
        },
        getLastPersisted: () => this.lastPersisted,
        setLastPersisted: (issues) => {
          this.lastPersisted = issues;
        },
        write: (issues) => this.storage.write(issues),
      },
      disposition,
    );
  }

  async submitIssue(
    rawPayload: unknown,
    senderTabId: number | undefined,
  ): Promise<UiIssueListResponse> {
    await this.ready;
    await this.deps.ruleStore.waitUntilReady();

    const payload = parseUiIssueSubmissionPayload(rawPayload);
    if (payload === null) {
      return {
        ok: false,
        error: {
          code: 'INVALID_UI_ISSUE',
          message: 'The submitted UI issue is invalid.',
        },
      };
    }

    const rule = this.deps.ruleStore.getEnabledRule(payload.ruleId);
    if (rule === undefined || rule.name !== payload.ruleName) {
      return {
        ok: false,
        error: {
          code: 'INVALID_UI_ISSUE',
          message: 'The UI issue rule is missing or disabled.',
        },
      };
    }
    if (rule.severity !== payload.severity) {
      return {
        ok: false,
        error: {
          code: 'INVALID_UI_ISSUE',
          message: 'The UI issue severity does not match the rule.',
        },
      };
    }

    const session = this.deps.getSessionState();
    if (!isActiveSession(session) || session.status !== 'recording') {
      return {
        ok: false,
        error: {
          code: 'STALE_UI_ISSUE',
          message: 'UI issues are only accepted while recording.',
        },
      };
    }

    if (payload.sessionId !== session.id) {
      return {
        ok: false,
        error: {
          code: 'STALE_UI_ISSUE',
          message: 'The submitted UI issue does not match the active session.',
        },
      };
    }

    if (senderTabId === undefined || senderTabId !== session.targetTabId) {
      return {
        ok: false,
        error: {
          code: 'STALE_UI_ISSUE',
          message: 'UI issues are only accepted from the monitored tab.',
        },
      };
    }

    const fingerprint = buildUiIssueFingerprint(payload);
    const existing = this.findIssueByFingerprint(fingerprint);
    const nextIssues = [...this.issues];

    if (existing !== undefined) {
      const updated: UiIssue = {
        ...existing,
        lastSeenAt: payload.timestamp,
        occurrenceCount: existing.occurrenceCount + 1,
      };
      const index = nextIssues.findIndex((issue) => issue.id === existing.id);
      nextIssues[index] = updated;
    } else {
      if (this.issues.length >= this.getMaxStoredIssues()) {
        return {
          ok: false,
          error: {
            code: 'UI_ISSUE_LIMIT_REACHED',
            message: 'The UI issue limit for this session has been reached.',
          },
        };
      }

      const issue = this.createIssue(payload);
      this.fingerprints.set(issue.id, fingerprint);
      nextIssues.push(issue);

      try {
        await this.storage.write(nextIssues);
      } catch {
        return {
          ok: false,
          error: {
            code: 'STORAGE_ERROR',
            message: 'The UI issue could not be saved.',
          },
        };
      }

      this.issues = nextIssues;
      this.lastPersisted = nextIssues;
      this.deps.onNewUniqueIssue?.({
        issueCategory: 'ui',
        issueId: issue.id,
      });
      return { ok: true, issues: this.getIssues() };
    }

    try {
      await this.storage.write(nextIssues);
    } catch {
      return {
        ok: false,
        error: {
          code: 'STORAGE_ERROR',
          message: 'The UI issue could not be saved.',
        },
      };
    }

    this.issues = nextIssues;
    this.lastPersisted = nextIssues;
    return { ok: true, issues: this.getIssues() };
  }

  private findIssueByFingerprint(fingerprint: string): UiIssue | undefined {
    for (const issue of this.issues) {
      const existingFingerprint = this.fingerprints.get(issue.id);
      if (existingFingerprint === fingerprint) {
        return issue;
      }
    }
    return undefined;
  }

  private createIssue(payload: UiIssueSubmissionPayload): UiIssue {
    const id = this.deps.createIssueId();
    return {
      id,
      sessionId: payload.sessionId,
      timestamp: payload.timestamp,
      lastSeenAt: payload.timestamp,
      ruleId: payload.ruleId,
      ruleName: payload.ruleName,
      severity: payload.severity,
      url: payload.url,
      element: payload.element,
      visibleMessage: payload.visibleMessage,
      occurrenceCount: 1,
      disposition: 'unexpected',
    };
  }

  private getMaxStoredIssues(): number {
    return this.deps.getMaxStoredIssues?.() ?? MAX_STORED_UI_ISSUES;
  }
}
