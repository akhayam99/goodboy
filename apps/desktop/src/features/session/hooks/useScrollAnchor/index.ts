import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { appScrollTo } from '@goodboy/ui';
import { scrollParentOf } from '../../../../shared/utils/scrollParentOf';

const SCROLL_ANCHOR_HOLD_MS = 260;

const DRIFT_EPSILON = 0.01;

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
          appScrollTo({ viewport: scroller, top: scroller.scrollTop + drift });
        }
        frame.current =
          now - start < SCROLL_ANCHOR_HOLD_MS ? window.requestAnimationFrame(hold) : null;
      };
      frame.current = window.requestAnimationFrame(hold);
    },
    [listRef],
  );
};
