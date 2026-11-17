type Params = {
  readonly key: string;
};

export const focusPanelElement = ({ key }: Params): void => {
  const target = Array.from(document.querySelectorAll<HTMLElement>('[data-dock-focus]')).find(
    (element) => element.dataset.dockFocus === key,
  );
  target?.focus({ preventScroll: true });
};
