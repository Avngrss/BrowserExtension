import type {
  NetworkIssue,
  NetworkIssueSubmissionPayload,
} from '@/src/domain/network-issue';
import type { IssueDisposition } from '@/src/domain/issue-disposition';
import {
  setAllStoredIssueDispositions,
  setStoredIssueDisposition,
  type IssueDispositionStoreResult,
} from '@/src/issues/issue-disposition-store-ops';
import { buildNetworkIssueFingerprint } from '@/src/network/network-fingerprint';
import { MAX_STORED_NETWORK_ISSUES } from '@/src/network/network-limits';
import {
  parseNetworkIssueList,
  parseNetworkIssueSubmissionPayload,
} from '@/src/network/network-issue-validation';
import type { NetworkIssueStorageAdapter } from '@/src/network/network-issue-storage';
import type { NewUniqueIssueNotifier } from '@/src/domain/new-unique-issue';
import type { SessionSnapshot } from '@/src/domain/session';
import { isActiveSession } from '@/src/domain/session';

export type NetworkIssueListResponse =
  | { ok: true; issues: NetworkIssue[] }
  | {
      ok: false;
      error: {
        code:
          | 'STORAGE_ERROR'
          | 'NETWORK_ISSUE_LIMIT_REACHED'
          | 'INVALID_NETWORK_ISSUE'
          | 'STALE_NETWORK_ISSUE';
        message: string;
      };
    };

export type NetworkIssueSubmitResponse = NetworkIssueListResponse;

export type NetworkIssueDispositionResponse =
  IssueDispositionStoreResult<NetworkIssue>;

export type NetworkIssueStoreDependencies = {
  getSessionState: () => SessionSnapshot;
  createIssueId: () => string;
  getMaxStoredIssues?: () => number;
  onNewUniqueIssue?: NewUniqueIssueNotifier;
};

export class NetworkIssueStore {
  private readonly ready: Promise<void>;
  private issues: NetworkIssue[] = [];
  private lastPersisted: NetworkIssue[] = [];
  private readonly fingerprints = new Map<string, string>();

  constructor(
    private readonly storage: NetworkIssueStorageAdapter,
    private readonly deps: NetworkIssueStoreDependencies,
  ) {
    this.ready = this.restoreFromStorage();
  }

  waitUntilReady(): Promise<void> {
    return this.ready;
  }

  getIssues(): NetworkIssue[] {
    return [...this.issues];
  }

  private rebuildFingerprints(): void {
    this.fingerprints.clear();
    for (const issue of this.issues) {
      this.fingerprints.set(
        issue.id,
        buildNetworkIssueFingerprint({
          source: issue.source,
          category: issue.category,
          method: issue.method,
          url: issue.url,
          status: issue.status,
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

      const parsed = parseNetworkIssueList(stored);
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
      throw new Error('Network issue storage write failed.');
    }
  }

  async getIssueList(): Promise<NetworkIssueListResponse> {
    await this.ready;
    return { ok: true, issues: this.getIssues() };
  }

  async setIssueDisposition(
    issueId: string,
    disposition: IssueDisposition,
  ): Promise<NetworkIssueDispositionResponse> {
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
  ): Promise<NetworkIssueDispositionResponse> {
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
  ): Promise<NetworkIssueSubmitResponse> {
    await this.ready;

    const payload = parseNetworkIssueSubmissionPayload(rawPayload);
    if (payload === null) {
      return {
        ok: false,
        error: {
          code: 'INVALID_NETWORK_ISSUE',
          message: 'The submitted network issue is invalid.',
        },
      };
    }

    const session = this.deps.getSessionState();
    if (!isActiveSession(session) || session.status !== 'recording') {
      return {
        ok: false,
        error: {
          code: 'STALE_NETWORK_ISSUE',
          message: 'Network issues are only accepted while recording.',
        },
      };
    }

    if (payload.sessionId !== session.id) {
      return {
        ok: false,
        error: {
          code: 'STALE_NETWORK_ISSUE',
          message:
            'The submitted network issue does not match the active session.',
        },
      };
    }

    if (senderTabId === undefined || senderTabId !== session.targetTabId) {
      return {
        ok: false,
        error: {
          code: 'STALE_NETWORK_ISSUE',
          message: 'Network issues are only accepted from the monitored tab.',
        },
      };
    }

    const fingerprint = buildNetworkIssueFingerprint(payload);
    const existing = this.findIssueByFingerprint(fingerprint);
    const nextIssues = [...this.issues];

    if (existing !== undefined) {
      const updated: NetworkIssue = {
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
            code: 'NETWORK_ISSUE_LIMIT_REACHED',
            message:
              'The network issue limit for this session has been reached.',
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
            message: 'The network issue could not be saved.',
          },
        };
      }

      this.issues = nextIssues;
      this.lastPersisted = nextIssues;
      this.deps.onNewUniqueIssue?.({
        issueCategory: 'network',
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
          message: 'The network issue could not be saved.',
        },
      };
    }

    this.issues = nextIssues;
    this.lastPersisted = nextIssues;
    return { ok: true, issues: this.getIssues() };
  }

  private findIssueByFingerprint(
    fingerprint: string,
  ): NetworkIssue | undefined {
    for (const issue of this.issues) {
      const existingFingerprint = this.fingerprints.get(issue.id);
      if (existingFingerprint === fingerprint) {
        return issue;
      }
    }
    return undefined;
  }

  private createIssue(payload: NetworkIssueSubmissionPayload): NetworkIssue {
    const id = this.deps.createIssueId();
    return {
      id,
      sessionId: payload.sessionId,
      timestamp: payload.timestamp,
      lastSeenAt: payload.timestamp,
      source: payload.source,
      category: payload.category,
      method: payload.method,
      url: payload.url,
      status: payload.status,
      statusText: payload.statusText,
      durationMs: payload.durationMs,
      failureMessage: payload.failureMessage,
      occurrenceCount: 1,
      disposition: 'unexpected',
    };
  }

  private getMaxStoredIssues(): number {
    return this.deps.getMaxStoredIssues?.() ?? MAX_STORED_NETWORK_ISSUES;
  }
}
