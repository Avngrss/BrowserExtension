import type { NetworkIssue } from '@/src/domain/network-issue';

let issues: NetworkIssue[] = [];
const listeners = new Set<(next: NetworkIssue[]) => void>();

export const networkIssueClientMock = {
  reset(): void {
    issues = [];
    listeners.clear();
  },
  setIssues(next: NetworkIssue[]): void {
    issues = [...next];
    for (const listener of listeners) {
      listener(issues);
    }
  },
  getIssues(): Promise<{ ok: true; issues: NetworkIssue[] }> {
    return Promise.resolve({ ok: true, issues });
  },
  getIssuesSnapshot(): NetworkIssue[] {
    return issues;
  },
  subscribe(listener: (next: NetworkIssue[]) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function resetNetworkIssueClientMock(): void {
  networkIssueClientMock.reset();
}
