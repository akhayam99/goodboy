import { useCallback, useEffect, useRef, type RefObject } from 'react';

const SCROLL_ANCHOR_HOLD_MS = 260;

const DRIFT_EPSILON = 0.01;

const isScrollable = ({ element }: { readonly element: HTMLElement }): boolean => {
  const { overflowY } = window.getComputedStyle(element);
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
};

const scrollParentOf = ({ element }: { readonly element: HTMLElement }): HTMLElement | null => {
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

type Params = {
  readonly listRef: RefObject<HTMLElement | null>;
};

export type ScrollAnchor = (params: { readonly rowId: string }) => void;

export const useScrollAnchor = ({ listRef }: Params): ScrollAnchor => {
  const frame = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current);
      }
    },
    [],
  );

  return useCallback(
    ({ rowId }) => {
      const row = Array.from(
        listRef.current?.querySelectorAll<HTMLElement>('[data-row-id]') ?? [],
      ).find((element) => element.dataset.rowId === rowId);
      if (row === undefined) {
        return;
      }
      const scroller = scrollParentOf({ element: row });
      if (scroller === null) {
        return;
      }
      const top = row.getBoundingClientRect().top;
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current);
      }
      const start = performance.now();
      const hold = (now: number) => {
        const drift = row.getBoundingClientRect().top - top;
        if (Math.abs(drift) > DRIFT_EPSILON) {
          scroller.scrollTop += drift;
        }
        frame.current =
          now - start < SCROLL_ANCHOR_HOLD_MS ? window.requestAnimationFrame(hold) : null;
      };
      frame.current = window.requestAnimationFrame(hold);
    },
    [listRef],
  );
};
