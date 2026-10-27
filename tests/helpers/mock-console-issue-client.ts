import type { ConsoleIssue } from '@/src/domain/console-issue';

let issues: ConsoleIssue[] = [];
const listeners = new Set<(next: ConsoleIssue[]) => void>();

export const consoleIssueClientMock = {
  reset(): void {
    issues = [];
    listeners.clear();
  },
  setIssues(next: ConsoleIssue[]): void {
    issues = [...next];
    for (const listener of listeners) {
      listener(issues);
    }
  },
  getIssues(): Promise<{ ok: true; issues: ConsoleIssue[] }> {
    return Promise.resolve({ ok: true, issues });
  },
  getIssuesSnapshot(): ConsoleIssue[] {
    return issues;
  },
  subscribe(listener: (next: ConsoleIssue[]) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function resetConsoleIssueClientMock(): void {
  consoleIssueClientMock.reset();
}
