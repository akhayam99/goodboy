import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import { anchorShift } from './anchorShift';
import { pickAnchor } from './pickAnchor';

const SCROLL_IDLE_MS = 150;
const INPUT_EVENTS = ['wheel', 'touchmove', 'keydown', 'pointerdown'] as const;
const ANCHOR_KEY_ATTRIBUTE = 'data-anchor-key';

type MeasuredParams = {
  readonly key: string;
  readonly px: number;
};

type Params = {
  readonly viewportRef: RefObject<HTMLElement | null>;
  readonly rowSelector: string;
  readonly shouldHold?: () => boolean;
  readonly onRowMeasured?: (params: MeasuredParams) => void;
};

type Anchor = {
  readonly row: Element;
  readonly offset: number;
};

type SizeParams = {
  readonly entry: ResizeObserverEntry;
};

const heightOf = ({ entry }: SizeParams): number =>
  entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;

export const useScrollAnchor = ({
  viewportRef,
  rowSelector,
  shouldHold,
  onRowMeasured,
}: Params) => {
  const holdRef = useRef(shouldHold);
  holdRef.current = shouldHold;
  const measuredRef = useRef(onRowMeasured);
  measuredRef.current = onRowMeasured;
  const isSuspended = useRef(false);
  const releaseRef = useRef<(() => void) | null>(null);

  const suspend = useCallback(() => {
    isSuspended.current = true;
    releaseRef.current?.();
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    viewport.style.overflowAnchor = 'none';
    let anchor: Anchor | null = null;
    let isDragging = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const observed = new Set<Element>();

    const viewportTop = () => viewport.getBoundingClientRect().top;

    const record = () => {
      const rows = viewport.querySelectorAll(rowSelector);
      const top = viewportTop();
      const index = pickAnchor({
        count: rows.length,
        bottomOf: ({ index: at }) => (rows[at]?.getBoundingClientRect().bottom ?? top) - top,
        edge: 0,
      });
      const row = index === null ? undefined : rows[index];
      anchor = row === undefined ? null : { row, offset: row.getBoundingClientRect().top - top };
    };

    const isHeld = () => isSuspended.current || isDragging || holdRef.current?.() === true;

    const compensate = () => {
      if (anchor === null || !anchor.row.isConnected) {
        record();
        return;
      }
      const shift = anchorShift({
        savedOffset: anchor.offset,
        currentOffset: anchor.row.getBoundingClientRect().top - viewportTop(),
        isHeld: isHeld(),
      });
      if (shift !== 0) {
        viewport.scrollTop += shift;
      }
      record();
    };

    const clearIdle = () => {
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const scheduleRelease = () => {
      clearIdle();
      idleTimer = setTimeout(() => {
        idleTimer = null;
        if (isDragging) {
          return;
        }
        isSuspended.current = false;
        record();
      }, SCROLL_IDLE_MS);
    };
    releaseRef.current = scheduleRelease;

    const resize = new ResizeObserver((entries) => {
      const measured = measuredRef.current;
      if (measured !== undefined) {
        for (const entry of entries) {
          const key = entry.target.getAttribute(ANCHOR_KEY_ATTRIBUTE);
          const px = heightOf({ entry });
          if (key !== null && px > 0) {
            measured({ key, px });
          }
        }
      }
      compensate();
    });

    const syncRows = () => {
      for (const row of observed) {
        if (!row.isConnected) {
          resize.unobserve(row);
          observed.delete(row);
        }
      }
      const content = viewport.firstElementChild;
      const targets = [
        ...(content === null ? [] : [content]),
        ...viewport.querySelectorAll(rowSelector),
      ];
      for (const row of targets) {
        if (!observed.has(row)) {
          observed.add(row);
          resize.observe(row);
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

    const onScroll = () => {
      if (isSuspended.current) {
        scheduleRelease();
      }
      record();
    };

    const onInput = () => {
      clearIdle();
      isSuspended.current = false;
    };

    const root = viewport.parentElement;
    const onRootPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && viewport.contains(event.target)) {
        return;
      }
      isDragging = true;
      isSuspended.current = true;
      clearIdle();
    };
    const onPointerUp = () => {
      if (!isDragging) {
        return;
      }
      isDragging = false;
      scheduleRelease();
    };

    syncRows();
    record();
    viewport.addEventListener('scroll', onScroll, { passive: true });
    for (const name of INPUT_EVENTS) {
      viewport.addEventListener(name, onInput, { passive: true });
    }
    root?.addEventListener('pointerdown', onRootPointerDown, { capture: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      releaseRef.current = null;
      clearIdle();
      if (syncFrame !== null) {
        cancelAnimationFrame(syncFrame);
      }
      resize.disconnect();
      mutate.disconnect();
      viewport.removeEventListener('scroll', onScroll);
      for (const name of INPUT_EVENTS) {
        viewport.removeEventListener(name, onInput);
      }
      root?.removeEventListener('pointerdown', onRootPointerDown, { capture: true });
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [rowSelector, viewportRef]);

  return { suspend };
};
