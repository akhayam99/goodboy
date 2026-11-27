import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { HomeWidgetId, WidgetSize } from '../../grid/homeWidgets';
import { snapSizeOf } from '../../layout/snapSizeOf';
import { stepSizeOf } from '../../layout/stepSizeOf';
import { DURATION_QUICK_MS } from '@goodboy/ui';

const RESIZE_THRESHOLD_PX = 4;
const GRID_GAP_PX = 12;

type SizeOfParams = {
  readonly id: HomeWidgetId;
};

type CommitParams = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
};

type Params = {
  readonly gridRef: RefObject<HTMLDivElement | null>;
  readonly columns: number;
  readonly isEnabled: boolean;
  readonly sizeOf: (params: SizeOfParams) => WidgetSize;
  readonly onCommit: (params: CommitParams) => void;
};

export type ResizePreview = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
  readonly contentSize: WidgetSize;
};

type PointerParams = {
  readonly id: HomeWidgetId;
  readonly event: ReactPointerEvent<HTMLElement>;
};

type CycleParams = {
  readonly id: HomeWidgetId;
  readonly step: 1 | -1;
  readonly isWrapping: boolean;
};

type WidgetResize = {
  readonly preview: ResizePreview | null;
  readonly onPointerDown: (params: PointerParams) => void;
  readonly cycle: (params: CycleParams) => void;
};

type Candidate = {
  readonly id: HomeWidgetId;
  readonly x: number;
  readonly y: number;
  readonly size: WidgetSize;
  readonly isShift: boolean;
};

export const useWidgetResize = ({
  gridRef,
  columns,
  isEnabled,
  sizeOf,
  onCommit,
}: Params): WidgetResize => {
  const [preview, setPreview] = useState<ResizePreview | null>(null);
  const previewRef = useRef<ResizePreview | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ columns, isEnabled, sizeOf, onCommit });
  latestRef.current = { columns, isEnabled, sizeOf, onCommit };

  const show = useCallback((next: ResizePreview | null): void => {
    previewRef.current = next;
    setPreview(next);
  }, []);

  const stop = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    document.body.style.userSelect = '';
  }, []);

  const cycle = useCallback(({ id, step, isWrapping }: CycleParams): void => {
    const size = latestRef.current.sizeOf({ id });
    const next = stepSizeOf({ id, size, step, isWrapping });
    if (next !== size) {
      latestRef.current.onCommit({ id, size: next });
    }
  }, []);

  const onPointerDown = useCallback(
    ({ id, event }: PointerParams): void => {
      const grid = gridRef.current;
      if (
        grid === null ||
        !latestRef.current.isEnabled ||
        abortRef.current !== null ||
        event.button !== 0
      ) {
        return;
      }
      const start: Candidate = {
        id,
        x: event.clientX,
        y: event.clientY,
        size: latestRef.current.sizeOf({ id }),
        isShift: event.shiftKey,
      };
      const cell = grid.querySelector<HTMLElement>(`[data-home-cell="${id}"]`);
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;
      let isDragging = false;
      const cancel = () => {
        stop();
        show(null);
      };
      window.addEventListener(
        'pointermove',
        (move) => {
          if (
            !isDragging &&
            Math.hypot(move.clientX - start.x, move.clientY - start.y) < RESIZE_THRESHOLD_PX
          ) {
            return;
          }
          if (cell === null) {
            return;
          }
          if (!isDragging) {
            isDragging = true;
            document.body.style.userSelect = 'none';
          }
          const gridWidth = grid.getBoundingClientRect().width;
          const pitch = (gridWidth + GRID_GAP_PX) / latestRef.current.columns;
          const span = (move.clientX - cell.getBoundingClientRect().left + GRID_GAP_PX) / pitch;
          const current = previewRef.current?.size ?? start.size;
          const size = snapSizeOf({
            id,
            columns: latestRef.current.columns,
            span,
            current,
          });
          if (size === current && previewRef.current !== null) {
            return;
          }
          const content = previewRef.current?.contentSize ?? start.size;
          show({ id, size, contentSize: content });
          if (settleTimerRef.current !== null) {
            clearTimeout(settleTimerRef.current);
          }
          settleTimerRef.current = setTimeout(() => {
            settleTimerRef.current = null;
            const live = previewRef.current;
            if (live !== null) {
              show({ ...live, contentSize: live.size });
            }
          }, DURATION_QUICK_MS);
        },
        { signal },
      );
      window.addEventListener(
        'pointerup',
        () => {
          const final = previewRef.current;
          stop();
          show(null);
          if (!isDragging) {
            cycle({ id, step: start.isShift ? -1 : 1, isWrapping: true });
            return;
          }
          if (final !== null && final.size !== start.size) {
            latestRef.current.onCommit({ id, size: final.size });
          }
        },
        { signal },
      );
      window.addEventListener('pointercancel', cancel, { signal });
      window.addEventListener('blur', cancel, { signal });
      window.addEventListener(
        'keydown',
        (key) => {
          if (key.key !== 'Escape') {
            return;
          }
          key.preventDefault();
          key.stopPropagation();
          cancel();
        },
        { capture: true, signal },
      );
    },
    [cycle, gridRef, show, stop],
  );

  useEffect(() => stop, [stop]);

  return { preview, onPointerDown, cycle };
};
