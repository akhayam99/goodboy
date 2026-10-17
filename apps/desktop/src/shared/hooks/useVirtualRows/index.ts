import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

const UNMEASURED_ROWS = 40;
const OVERSCAN_ROWS = 8;

type VirtualWindow = {
  readonly start: number;
  readonly end: number;
  readonly firstVisible: number;
};

type Params = {
  readonly count: number;
  readonly rowHeight: number;
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly isEnabled: boolean;
};

type Result = VirtualWindow & {
  readonly scrollToIndex: (index: number) => void;
};

const SCROLLING = new Set(['auto', 'scroll', 'overlay']);

const scrollParentOf = (node: HTMLElement): HTMLElement | null => {
  let parent = node.parentElement;
  while (parent !== null) {
    if (SCROLLING.has(getComputedStyle(parent).overflowY)) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
};

type WindowParams = {
  readonly count: number;
  readonly rowHeight: number;
  readonly anchor: HTMLElement | null;
  readonly focusIndex: number;
};

type FallbackParams = {
  readonly count: number;
  readonly focusIndex: number;
};

const fallbackOf = ({ count, focusIndex }: FallbackParams): VirtualWindow => {
  const start = Math.max(0, Math.min(focusIndex - UNMEASURED_ROWS / 2, count - UNMEASURED_ROWS));
  return { start, end: Math.min(count, start + UNMEASURED_ROWS), firstVisible: start };
};

const windowOf = ({ count, rowHeight, anchor, focusIndex }: WindowParams): VirtualWindow => {
  const fallback = fallbackOf({ count, focusIndex });
  if (anchor === null) {
    return fallback;
  }
  const scroller = scrollParentOf(anchor);
  if (scroller === null || scroller.clientHeight === 0) {
    return fallback;
  }
  const offset = anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  const first = Math.max(0, Math.floor(-offset / rowHeight));
  const visible = Math.ceil(scroller.clientHeight / rowHeight);
  return {
    start: Math.max(0, first - OVERSCAN_ROWS),
    end: Math.min(count, first + visible + OVERSCAN_ROWS),
    firstVisible: Math.min(first, Math.max(0, count - 1)),
  };
};

const sameWindow = (left: VirtualWindow, right: VirtualWindow): boolean =>
  left.start === right.start && left.end === right.end && left.firstVisible === right.firstVisible;

export const useVirtualRows = ({ count, rowHeight, anchorRef, isEnabled }: Params): Result => {
  const focusRef = useRef(0);
  const [range, setRange] = useState<VirtualWindow>(() => ({
    start: 0,
    end: isEnabled ? Math.min(count, UNMEASURED_ROWS) : count,
    firstVisible: 0,
  }));

  const measure = useCallback(() => {
    const next = isEnabled
      ? windowOf({ count, rowHeight, anchor: anchorRef.current, focusIndex: focusRef.current })
      : { start: 0, end: count, firstVisible: 0 };
    setRange((current) => (sameWindow(current, next) ? current : next));
  }, [count, rowHeight, anchorRef, isEnabled]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!isEnabled || anchor === null) {
      return;
    }
    const scroller = scrollParentOf(anchor);
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      target.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [anchorRef, isEnabled, measure]);

  const scrollToIndex = useCallback(
    (index: number) => {
      focusRef.current = index;
      const anchor = anchorRef.current;
      if (anchor === null) {
        return;
      }
      const scroller = scrollParentOf(anchor);
      if (scroller === null || scroller.clientHeight === 0) {
        measure();
        return;
      }
      const offset = anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      const rowTop = offset + index * rowHeight;
      if (rowTop >= rowHeight && rowTop + rowHeight <= scroller.clientHeight) {
        return;
      }
      scroller.scrollTop += rowTop - rowHeight;
      measure();
    },
    [anchorRef, rowHeight, measure],
  );

  return { ...range, scrollToIndex };
};
