const HOVER_SURFACE_SELECTOR = '[data-hover-surface]';

type Watcher = { readonly onChange: () => void };

type InsideParams = { readonly anchor: Element | null };

const watchers = new Set<Watcher>();

let openCount = 0;

const notify = (): void => {
  watchers.forEach((watcher) => watcher.onChange());
};

export const hoverSurfaces = {
  register: (): (() => void) => {
    openCount += 1;
    notify();
    let isRegistered = true;
    return () => {
      if (!isRegistered) {
        return;
      }
      isRegistered = false;
      openCount -= 1;
      notify();
    };
  },
  watch: ({ onChange }: Watcher): (() => void) => {
    const watcher: Watcher = { onChange };
    watchers.add(watcher);
    return () => {
      watchers.delete(watcher);
    };
  },
  count: (): number => openCount,
  isInside: ({ anchor }: InsideParams): boolean =>
    anchor !== null && anchor.closest(HOVER_SURFACE_SELECTOR) !== null,
};
