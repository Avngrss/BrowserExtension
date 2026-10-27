import {
  createDefaultIssueMarkSessionData,
  type IssueMark,
  type IssueMarkReportScope,
  type IssueMarkReportScopeWithoutMark,
  type IssueMarkSessionData,
} from '@/src/domain/issue-mark';
import { parseIssueMarkSessionData } from '@/src/issue-marks/issue-mark-validation';
import type { IssueMarkStorageAdapter } from '@/src/issue-marks/issue-mark-storage';

export class IssueMarkStore {
  private readonly ready: Promise<void>;
  private data: IssueMarkSessionData = createDefaultIssueMarkSessionData();

  constructor(private readonly storage: IssueMarkStorageAdapter) {
    this.ready = this.restoreFromStorage();
  }

  waitUntilReady(): Promise<void> {
    return this.ready;
  }

  getData(): IssueMarkSessionData {
    return {
      mark: this.data.mark === null ? null : { ...this.data.mark },
      reportScopeWithoutMark: this.data.reportScopeWithoutMark,
    };
  }

  getMarkForSession(sessionId: string): IssueMark | null {
    if (this.data.mark === null || this.data.mark.sessionId !== sessionId) {
      return null;
    }
    return { ...this.data.mark };
  }

  getReportScopeWithoutMark(): IssueMarkReportScopeWithoutMark {
    return this.data.reportScopeWithoutMark;
  }

  async saveMark(mark: IssueMark): Promise<void> {
    await this.ready;
    this.data = {
      ...this.data,
      mark: { ...mark },
    };
    await this.persist();
  }

  async setReportScope(scope: IssueMarkReportScope): Promise<void> {
    await this.ready;
    if (this.data.mark === null) {
      return;
    }
    this.data = {
      ...this.data,
      mark: { ...this.data.mark, reportScope: scope },
    };
    await this.persist();
  }

  async setReportScopeWithoutMark(
    scope: IssueMarkReportScopeWithoutMark,
  ): Promise<void> {
    await this.ready;
    this.data = {
      ...this.data,
      reportScopeWithoutMark: scope,
    };
    await this.persist();
  }

  async clear(): Promise<void> {
    await this.ready;
    this.data = createDefaultIssueMarkSessionData();
    await this.storage.remove();
  }

  private async restoreFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.read();
      const parsed = parseIssueMarkSessionData(stored);
      if (parsed === null) {
        await this.storage.remove();
        this.data = createDefaultIssueMarkSessionData();
        return;
      }
      this.data = parsed;
    } catch {
      this.data = createDefaultIssueMarkSessionData();
    }
  }

  private async persist(): Promise<void> {
    await this.storage.write(this.data);
  }
}
