import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { DURATION_BASE_MS, DURATION_QUICK_MS, canAnimate } from '@goodboy/ui';
import type { HomeWidgetId } from '../../grid/homeWidgets';
import { motionEaseOf } from '../../reorder/motionEaseOf';
import { STEP_DELAY_MS } from '../../reorder/stepDelay';

type Params = {
  readonly gridRef: RefObject<HTMLDivElement | null>;
  readonly skipId: HomeWidgetId | null;
};

type Box = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

type CellParams = {
  readonly cell: HTMLElement;
};

type MeasureParams = {
  readonly grid: HTMLElement;
};

const boxOf = ({ cell }: CellParams): Box => ({
  left: cell.offsetLeft,
  top: cell.offsetTop,
  width: cell.offsetWidth,
  height: cell.offsetHeight,
});

const measure = ({ grid }: MeasureParams): ReadonlyMap<string, HTMLElement> => {
  const cells = new Map<string, HTMLElement>();
  grid.querySelectorAll<HTMLElement>('[data-home-cell]').forEach((cell) => {
    const id = cell.dataset.homeCell;
    if (id !== undefined) {
      cells.set(id, cell);
    }
  });
  return cells;
};

type InFlightParams = {
  readonly grid: HTMLElement;
  readonly cell: HTMLElement;
  readonly now: Box;
};

const inFlightOffsetOf = ({ grid, cell, now }: InFlightParams): { dx: number; dy: number } => {
  if (cell.getAnimations().length === 0) {
    return { dx: 0, dy: 0 };
  }
  const rect = cell.getBoundingClientRect();
  const origin = grid.getBoundingClientRect();
  return { dx: rect.left - origin.left - now.left, dy: rect.top - origin.top - now.top };
};

export const useGridFlip = ({ gridRef, skipId }: Params): void => {
  const boxesRef = useRef(new Map<string, Box>());
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (grid === null) {
      return;
    }
    const cells = measure({ grid });
    const next = new Map<string, Box>();
    const isMotionOn = canAnimate({ element: grid }) && typeof grid.animate === 'function';
    const easing = isMotionOn ? motionEaseOf({ token: '--ease-enter' }) : '';
    cells.forEach((cell, id) => {
      const now = boxOf({ cell });
      next.set(id, now);
      const before = boxesRef.current.get(id);
      if (!isMotionOn || before === undefined || id === skipId) {
        return;
      }
      const flight = inFlightOffsetOf({ grid, cell, now });
      const dx = before.left - now.left + flight.dx;
      const dy = before.top - now.top + flight.dy;
      const isResized = before.width !== now.width || before.height !== now.height;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && !isResized) {
        return;
      }
      cell.getAnimations().forEach((animation) => animation.cancel());
      const from = isResized
        ? {
            transform: `translate(${dx}px, ${dy}px)`,
            width: `${before.width}px`,
            height: `${before.height}px`,
          }
        : { transform: `translate(${dx}px, ${dy}px)` };
      const to = isResized
        ? { transform: 'none', width: `${now.width}px`, height: `${now.height}px` }
        : { transform: 'none' };
      const run = cell.animate([from, to], { duration: DURATION_BASE_MS, easing });
      if (!isResized) {
        return;
      }
      const content = cell.querySelector<HTMLElement>('[data-home-slot]');
      cell.style.overflow = 'hidden';
      if (content !== null) {
        content.style.minWidth = `${now.width}px`;
        content.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: DURATION_QUICK_MS,
          delay: STEP_DELAY_MS,
          easing,
          fill: 'backwards',
        });
      }
      const settle = () => {
        cell.style.overflow = '';
        if (content !== null) {
          content.style.minWidth = '';
        }
      };
      run.addEventListener('finish', settle);
      run.addEventListener('cancel', settle);
    });
    boxesRef.current = next;
  });
  useEffect(() => {
    const grid = gridRef.current;
    if (grid === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      const next = new Map<string, Box>();
      measure({ grid }).forEach((cell, id) => next.set(id, boxOf({ cell })));
      boxesRef.current = next;
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [gridRef]);
};
