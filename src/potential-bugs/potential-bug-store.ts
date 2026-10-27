import type {
  PotentialBug,
  PotentialBugStatus,
} from '@/src/domain/potential-bug';
import {
  applyDetectedIssue,
  createManualBug,
  type DetectedIssueInput,
  type ManualBugInput,
} from '@/src/potential-bugs/potential-bug-grouping';
import {
  parseStoredPotentialBugs,
  type PotentialBugStorageAdapter,
} from '@/src/potential-bugs/potential-bug-storage';

export class PotentialBugStore {
  private readonly ready: Promise<void>;
  private bugs: PotentialBug[] = [];
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly storage: PotentialBugStorageAdapter,
    private readonly createId: () => string,
  ) {
    this.ready = this.restore();
  }

  waitUntilReady(): Promise<void> {
    return this.ready;
  }

  getBugs(): PotentialBug[] {
    return this.bugs.map((bug) => ({ ...bug }));
  }

  getBugsForSession(sessionId: string): PotentialBug[] {
    return this.getBugs().filter((bug) => bug.sessionId === sessionId);
  }

  recordDetectedIssue(
    input: DetectedIssueInput,
  ): Promise<{ bug: PotentialBug | null; created: boolean }> {
    return this.serialize(async () => {
      const result = applyDetectedIssue(this.bugs, input, this.createId);
      if (result.bug === null) {
        return { bug: null, created: false };
      }
      this.bugs = result.bugs;
      await this.storage.write(this.bugs);
      return { bug: result.bug, created: result.created };
    });
  }

  captureManual(input: ManualBugInput): Promise<PotentialBug> {
    return this.serialize(async () => {
      const result = createManualBug(this.bugs, input, this.createId);
      this.bugs = result.bugs;
      await this.storage.write(this.bugs);
      return result.bug;
    });
  }

  setStatus(bugId: string, status: PotentialBugStatus): Promise<boolean> {
    return this.serialize(async () => {
      if (!this.bugs.some((bug) => bug.id === bugId)) {
        return false;
      }
      this.bugs = this.bugs.map((bug) =>
        bug.id === bugId ? { ...bug, status } : bug,
      );
      await this.storage.write(this.bugs);
      return true;
    });
  }

  clear(): Promise<void> {
    return this.serialize(async () => {
      this.bugs = [];
      await this.storage.remove();
    });
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      await this.ready;
      return task();
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async restore(): Promise<void> {
    try {
      const parsed = parseStoredPotentialBugs(await this.storage.read());
      if (parsed === null) {
        await this.storage.remove();
        this.bugs = [];
        return;
      }
      this.bugs = parsed;
    } catch {
      this.bugs = [];
    }
  }
}
