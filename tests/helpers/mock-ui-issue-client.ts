import type { UiIssue } from '@/src/domain/ui-issue';

let issues: UiIssue[] = [];
const listeners = new Set<(next: UiIssue[]) => void>();

export const uiIssueClientMock = {
  reset(): void {
    issues = [];
    listeners.clear();
  },
  setIssues(next: UiIssue[]): void {
    issues = [...next];
    for (const listener of listeners) {
      listener(issues);
    }
  },
  getIssues(): Promise<{ ok: true; issues: UiIssue[] }> {
    return Promise.resolve({ ok: true, issues });
  },
  getIssuesSnapshot(): UiIssue[] {
    return issues;
  },
  subscribe(listener: (next: UiIssue[]) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function resetUiIssueClientMock(): void {
  uiIssueClientMock.reset();
}
