import type { CapturedAction } from '@/src/domain/action';

let actions: CapturedAction[] = [];
const listeners = new Set<(next: CapturedAction[]) => void>();

export const actionClientMock = {
  reset(): void {
    actions = [];
    listeners.clear();
  },
  setActions(next: CapturedAction[]): void {
    actions = [...next];
    for (const listener of listeners) {
      listener(actions);
    }
  },
  getActions(): Promise<{ ok: true; actions: CapturedAction[] }> {
    return Promise.resolve({ ok: true, actions });
  },
  subscribe(listener: (next: CapturedAction[]) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function resetActionClientMock(): void {
  actionClientMock.reset();
}
