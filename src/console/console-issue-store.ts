import type {
  ConsoleIssue,
  ConsoleIssueSubmissionPayload,
} from '@/src/domain/console-issue';
import type { IssueDisposition } from '@/src/domain/issue-disposition';
import {
  setAllStoredIssueDispositions,
  setStoredIssueDisposition,
  type IssueDispositionStoreResult,
} from '@/src/issues/issue-disposition-store-ops';
import { buildConsoleIssueFingerprint } from '@/src/console/issue-fingerprint';
import {
  parseConsoleIssueList,
  parseConsoleIssueSubmissionPayload,
} from '@/src/console/console-issue-validation';
import type { ConsoleIssueStorageAdapter } from '@/src/console/console-issue-storage';
import type { NewUniqueIssueNotifier } from '@/src/domain/new-unique-issue';
import type { SessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';

export const MAX_STORED_CONSOLE_ISSUES = 100;

export type ConsoleIssueListResponse =
  | { ok: true; issues: ConsoleIssue[] }
  | {
      ok: false;
      error: {
        code:
          | 'STORAGE_ERROR'
          | 'CONSOLE_ISSUE_LIMIT_REACHED'
          | 'INVALID_CONSOLE_ISSUE'
          | 'STALE_CONSOLE_ISSUE';
        message: string;
      };
    };

export type ConsoleIssueSubmitResponse = ConsoleIssueListResponse;

export type ConsoleIssueDispositionResponse =
  IssueDispositionStoreResult<ConsoleIssue>;

export type ConsoleIssueStoreDependencies = {
  getSessionState: () => SessionSnapshot;
  createIssueId: () => string;
  getMaxStoredIssues?: () => number;
  onNewUniqueIssue?: NewUniqueIssueNotifier;
};

export class ConsoleIssueStore {
  private readonly ready: Promise<void>;
  private issues: ConsoleIssue[] = [];
  private lastPersisted: ConsoleIssue[] = [];
  private readonly fingerprints = new Map<string, string>();

  constructor(
    private readonly storage: ConsoleIssueStorageAdapter,
    private readonly deps: ConsoleIssueStoreDependencies,
  ) {
    this.ready = this.restoreFromStorage();
  }

  waitUntilReady(): Promise<void> {
    return this.ready;
  }

  getIssues(): ConsoleIssue[] {
    return [...this.issues];
  }

  getUniqueIssueCount(): number {
    return this.issues.length;
  }

  private rebuildFingerprints(): void {
    this.fingerprints.clear();
    for (const issue of this.issues) {
      this.fingerprints.set(
        issue.id,
        buildConsoleIssueFingerprint({
          category: issue.category,
          message: issue.message,
          url: issue.url,
          stack: issue.stack,
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

      const parsed = parseConsoleIssueList(stored);
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
      throw new Error('Console issue storage write failed.');
    }
  }

  async getIssueList(): Promise<ConsoleIssueListResponse> {
    await this.ready;
    return { ok: true, issues: this.getIssues() };
  }

  async setIssueDisposition(
    issueId: string,
    disposition: IssueDisposition,
  ): Promise<ConsoleIssueDispositionResponse> {
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
  ): Promise<ConsoleIssueDispositionResponse> {
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
  ): Promise<ConsoleIssueSubmitResponse> {
    await this.ready;

    const payload = parseConsoleIssueSubmissionPayload(rawPayload);
    if (payload === null) {
      return {
        ok: false,
        error: {
          code: 'INVALID_CONSOLE_ISSUE',
          message: 'The submitted console issue is invalid.',
        },
      };
    }

    const session = this.deps.getSessionState();
    if (!isActiveSession(session) || session.status !== 'recording') {
      return {
        ok: false,
        error: {
          code: 'STALE_CONSOLE_ISSUE',
          message: 'Console issues are only accepted while recording.',
        },
      };
    }

    if (payload.sessionId !== session.id) {
      return {
        ok: false,
        error: {
          code: 'STALE_CONSOLE_ISSUE',
          message:
            'The submitted console issue does not match the active session.',
        },
      };
    }

    if (senderTabId === undefined || senderTabId !== session.targetTabId) {
      return {
        ok: false,
        error: {
          code: 'STALE_CONSOLE_ISSUE',
          message: 'Console issues are only accepted from the monitored tab.',
        },
      };
    }

    const fingerprint = buildConsoleIssueFingerprint(payload);
    const existing = this.findIssueByFingerprint(fingerprint);
    const nextIssues = [...this.issues];

    if (existing !== undefined) {
      const updated: ConsoleIssue = {
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
            code: 'CONSOLE_ISSUE_LIMIT_REACHED',
            message:
              'The console issue limit for this session has been reached.',
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
            message: 'The console issue could not be saved.',
          },
        };
      }

      this.issues = nextIssues;
      this.lastPersisted = nextIssues;
      this.deps.onNewUniqueIssue?.({
        issueCategory: 'console',
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
          message: 'The console issue could not be saved.',
        },
      };
    }

    this.issues = nextIssues;
    this.lastPersisted = nextIssues;
    return { ok: true, issues: this.getIssues() };
  }

  private findIssueByFingerprint(
    fingerprint: string,
  ): ConsoleIssue | undefined {
    for (const issue of this.issues) {
      const existingFingerprint = this.fingerprints.get(issue.id);
      if (existingFingerprint === fingerprint) {
        return issue;
      }
    }
    return undefined;
  }

  private createIssue(payload: ConsoleIssueSubmissionPayload): ConsoleIssue {
    const id = this.deps.createIssueId();
    return {
      id,
      sessionId: payload.sessionId,
      timestamp: payload.timestamp,
      lastSeenAt: payload.timestamp,
      category: payload.category,
      message: payload.message,
      url: payload.url,
      stack: payload.stack,
      occurrenceCount: 1,
      disposition: 'unexpected',
    };
  }

  private getMaxStoredIssues(): number {
    return this.deps.getMaxStoredIssues?.() ?? MAX_STORED_CONSOLE_ISSUES;
  }
}
