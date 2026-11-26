type Params = {
  readonly key: string;
  readonly isCurrent: () => boolean;
  readonly frames?: number;
};

export const focusPanelHead = ({ key, isCurrent, frames = 12 }: Params): void => {
  if (!isCurrent()) {
    return;
  }
  const pane = Array.from(document.querySelectorAll<HTMLElement>('[data-dock-focus]')).find(
    (element) => element.dataset.dockFocus === key,
  );
  const head = pane?.querySelector<HTMLElement>('[data-dock-panel-head]') ?? null;
  const target = head ?? pane ?? null;
  if (target !== null) {
    target.focus({ preventScroll: true });
    return;
  }
  if (frames > 0) {
    requestAnimationFrame(() => focusPanelHead({ key, isCurrent, frames: frames - 1 }));
  }
};
