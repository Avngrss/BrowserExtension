import { createDefaultIssueMarkSessionData } from '@/src/domain/issue-mark';
import type { IssueMarkSessionData } from '@/src/domain/issue-mark';

let data: IssueMarkSessionData = createDefaultIssueMarkSessionData();
const listeners = new Set<(next: IssueMarkSessionData) => void>();

export const issueMarkClientMock = {
  getData(): IssueMarkSessionData {
    return data;
  },
  setData(next: IssueMarkSessionData): void {
    data = next;
    for (const listener of listeners) {
      listener(data);
    }
  },
  reset(): void {
    data = createDefaultIssueMarkSessionData();
  },
  subscribe(listener: (next: IssueMarkSessionData) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
