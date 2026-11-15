type Params = {
  readonly element: HTMLElement;
};

const isScrollable = ({ element }: Params): boolean => {
  const { overflowY } = window.getComputedStyle(element);
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
};

export const scrollParentOf = ({ element }: Params): HTMLElement | null => {
  let current = element.parentElement;
  while (current !== null) {
    if (isScrollable({ element: current })) {
      return current;
    }
    current = current.parentElement;
  }
  const root = document.scrollingElement;
  return root instanceof HTMLElement ? root : null;
};
