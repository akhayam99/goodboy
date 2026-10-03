import { vi } from 'vitest';

type Callback = (entries: ReadonlyArray<ResizeObserverEntry>, observer: ResizeObserver) => void;

type Observed = {
  readonly callback: Callback;
  readonly targets: Set<Element>;
  readonly observer: ResizeObserver;
};

export type FakeResizeObservers = {
  readonly resizeAll: () => void;
  readonly observedCount: () => number;
};

export const installFakeResizeObserver = (): FakeResizeObservers => {
  const live = new Set<Observed>();
  class FakeResizeObserver {
    private readonly entry: Observed;

    constructor(callback: Callback) {
      this.entry = { callback, targets: new Set(), observer: this };
      live.add(this.entry);
    }

    observe(target: Element) {
      this.entry.targets.add(target);
    }

    unobserve(target: Element) {
      this.entry.targets.delete(target);
    }

    disconnect() {
      this.entry.targets.clear();
      live.delete(this.entry);
    }
  }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  return {
    resizeAll: () => {
      for (const entry of [...live]) {
        const entries = [...entry.targets].map(
          (target) =>
            ({ target, contentRect: target.getBoundingClientRect() }) as ResizeObserverEntry,
        );
        if (entries.length > 0) {
          entry.callback(entries, entry.observer);
        }
      }
    },
    observedCount: () => [...live].reduce((total, entry) => total + entry.targets.size, 0),
  };
};
