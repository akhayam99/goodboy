type Params = {
  readonly target: EventTarget | null;
  readonly viewport: HTMLElement;
  readonly deltaY: number;
};

const SCROLLING = new Set(['auto', 'scroll']);

type TowardParams = {
  readonly element: HTMLElement;
  readonly deltaY: number;
};

const canScrollToward = ({ element, deltaY }: TowardParams): boolean =>
  deltaY > 0
    ? element.scrollTop + element.clientHeight < element.scrollHeight - 1
    : element.scrollTop > 0;

export const isNestedScroll = ({ target, viewport, deltaY }: Params): boolean => {
  let element = target instanceof HTMLElement ? target : null;
  while (element !== null && element !== viewport) {
    if (
      element.scrollHeight > element.clientHeight + 1 &&
      SCROLLING.has(getComputedStyle(element).overflowY) &&
      canScrollToward({ element, deltaY })
    ) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
};
