import type {
  PotentialBug,
  PotentialBugStatus,
} from '@/src/domain/potential-bug';
import type { PotentialBugResponse } from '@/src/messaging/potential-bug-types';

let bugs: PotentialBug[] = [];
const listeners = new Set<(next: PotentialBug[]) => void>();
const captureCalls: { note?: string }[] = [];

function emit(): void {
  for (const listener of listeners) {
    listener(bugs);
  }
}

export const potentialBugClientMock = {
  getBugs(): Promise<PotentialBug[]> {
    return Promise.resolve(bugs);
  },
  setBugs(next: PotentialBug[]): void {
    bugs = next;
    emit();
  },
  getBugsSnapshot(): PotentialBug[] {
    return bugs;
  },
  getCaptureCalls(): { note?: string }[] {
    return captureCalls;
  },
  captureBugNow(input: { note?: string }): Promise<PotentialBugResponse> {
    captureCalls.push(input);
    return Promise.resolve({ ok: true, bugs });
  },
  setStatus(
    bugId: string,
    status: PotentialBugStatus,
  ): Promise<PotentialBugResponse> {
    bugs = bugs.map((bug) => (bug.id === bugId ? { ...bug, status } : bug));
    emit();
    return Promise.resolve({ ok: true, bugs });
  },
  reset(): void {
    bugs = [];
    captureCalls.length = 0;
  },
  subscribe(listener: (next: PotentialBug[]) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
