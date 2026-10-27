export const INPUT_DEBOUNCE_MS = 500;

type PendingInputEntry = {
  timer: ReturnType<typeof setTimeout> | undefined;
  emitted: boolean;
};

export class InputDebounceTracker {
  private readonly pending = new WeakMap<Element, PendingInputEntry>();
  private readonly tracked = new Set<Element>();

  schedule(
    element: Element,
    onFire: () => void,
    debounceMs = INPUT_DEBOUNCE_MS,
  ): void {
    this.tracked.add(element);
    const entry = this.pending.get(element) ?? {
      timer: undefined,
      emitted: false,
    };

    if (entry.emitted) {
      entry.emitted = false;
    }

    if (entry.timer !== undefined) {
      clearTimeout(entry.timer);
    }

    entry.timer = setTimeout(() => {
      entry.timer = undefined;
      if (!entry.emitted) {
        onFire();
        entry.emitted = true;
      }
    }, debounceMs);

    this.pending.set(element, entry);
  }

  flush(element: Element, onFire: () => void): void {
    const entry = this.pending.get(element);
    if (entry === undefined) {
      return;
    }

    if (entry.timer !== undefined) {
      clearTimeout(entry.timer);
      entry.timer = undefined;
    }

    if (!entry.emitted) {
      onFire();
      entry.emitted = true;
    }

    this.pending.set(element, entry);
  }

  cancelAll(): void {
    for (const element of this.tracked) {
      const entry = this.pending.get(element);
      if (entry?.timer !== undefined) {
        clearTimeout(entry.timer);
      }
      this.pending.delete(element);
    }
    this.tracked.clear();
  }
}
