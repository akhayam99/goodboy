import { useLayoutEffect, type RefObject } from 'react';

const NEAR_ATTRIBUTE = 'data-row-near';
const PRELOAD_MARGIN = '100% 0px';

type Params = {
  readonly viewportRef: RefObject<HTMLElement | null>;
  readonly rowSelector: string;
};

export const useRowPreload = ({ viewportRef, rowSelector }: Params): void => {
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const near = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.toggleAttribute(NEAR_ATTRIBUTE, entry.isIntersecting);
        }
      },
      { root: viewport, rootMargin: PRELOAD_MARGIN },
    );
    const observed = new Set<Element>();
    const syncRows = () => {
      for (const row of observed) {
        if (!row.isConnected) {
          near.unobserve(row);
          observed.delete(row);
        }
      }
      for (const row of viewport.querySelectorAll(rowSelector)) {
        if (!observed.has(row)) {
          observed.add(row);
          near.observe(row);
        }
      }
    };
    let syncFrame: number | null = null;
    const scheduleSync = () => {
      if (syncFrame !== null) {
        return;
      }
      syncFrame = requestAnimationFrame(() => {
        syncFrame = null;
        syncRows();
      });
    };
    const mutate = new MutationObserver(scheduleSync);
    mutate.observe(viewport, { childList: true, subtree: true });
    syncRows();
    return () => {
      if (syncFrame !== null) {
        cancelAnimationFrame(syncFrame);
      }
      mutate.disconnect();
      near.disconnect();
    };
  }, [viewportRef, rowSelector]);
};
