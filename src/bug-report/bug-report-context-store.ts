import type { BugReportContext } from '@/src/domain/bug-report-context';
import { parseBugReportContext } from '@/src/bug-report/bug-report-context-validation';
import type { BugReportContextStorageAdapter } from '@/src/bug-report/bug-report-context-storage';

export class BugReportContextStore {
  private readonly ready: Promise<void>;
  private context: BugReportContext | null = null;

  constructor(private readonly storage: BugReportContextStorageAdapter) {
    this.ready = this.restoreFromStorage();
  }

  waitUntilReady(): Promise<void> {
    return this.ready;
  }

  getContextForSession(sessionId: string): BugReportContext | null {
    if (this.context === null || this.context.sessionId !== sessionId) {
      return null;
    }
    return { ...this.context };
  }

  async saveContext(context: BugReportContext): Promise<void> {
    await this.ready;
    this.context = { ...context };
    await this.storage.write(this.context);
  }

  async clear(): Promise<void> {
    await this.ready;
    this.context = null;
    await this.storage.remove();
  }

  private async restoreFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.read();
      const parsed = parseBugReportContext(stored);
      if (parsed === null) {
        await this.storage.remove();
        this.context = null;
        return;
      }
      this.context = parsed;
    } catch {
      this.context = null;
    }
  }
}
