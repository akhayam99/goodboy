import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

const DRAG_THRESHOLD = 4;
const ACTION_SELECTOR = 'button, [role="button"], a, input, textarea, select';

type LassoRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

type Options<T extends string> = {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly onSelect: (ids: ReadonlyArray<T>, mode: 'replace' | 'add') => void;
  readonly requireAlt?: boolean;
};

type DragLasso = {
  readonly onPointerDown: (event: ReactPointerEvent) => void;
  readonly rect: LassoRect | null;
  readonly isDragging: boolean;
};

type Origin = {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly additive: boolean;
};

export const useDragLasso = <T extends string>({
  containerRef,
  onSelect,
  requireAlt = false,
}: Options<T>): DragLasso => {
  const [rect, setRect] = useState<LassoRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const originRef = useRef<Origin | null>(null);
  const draggedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const reset = useCallback(() => {
    originRef.current = null;
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setRect(null);
    setIsDragging(false);
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (event.button !== 0 || containerRef.current == null) {
        return;
      }
      const target = event.target as HTMLElement;
      if (!event.altKey && (requireAlt || target.closest(ACTION_SELECTOR) != null)) {
        return;
      }
      originRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        additive: event.shiftKey || event.altKey,
      };
    },
    [containerRef, requireAlt],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const origin = originRef.current;
      const container = containerRef.current;
      if (origin == null || container == null || event.pointerId !== origin.pointerId) {
        return;
      }
      if (
        Math.abs(event.clientX - origin.clientX) < DRAG_THRESHOLD &&
        Math.abs(event.clientY - origin.clientY) < DRAG_THRESHOLD
      ) {
        return;
      }
      event.preventDefault();
      if (!draggedRef.current) {
        draggedRef.current = true;
        container.setPointerCapture?.(origin.pointerId);
      }

      const bounds = container.getBoundingClientRect();
      const left = Math.min(origin.clientX, event.clientX);
      const top = Math.min(origin.clientY, event.clientY);
      const width = Math.abs(event.clientX - origin.clientX);
      const height = Math.abs(event.clientY - origin.clientY);

      setIsDragging(true);
      setRect({ left: left - bounds.left, top: top - bounds.top, width, height });

      if (frameRef.current != null) {
        return;
      }
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const ids: Array<T> = [];
        for (const node of container.querySelectorAll<HTMLElement>('[data-select-id]')) {
          const id = node.dataset.selectId;
          const box = node.getBoundingClientRect();
          if (
            id != null &&
            box.left < left + width &&
            box.right > left &&
            box.top < top + height &&
            box.bottom > top
          ) {
            ids.push(id as T);
          }
        }
        onSelectRef.current(ids, origin.additive ? 'add' : 'replace');
      });
    };

    const onPointerEnd = (event: PointerEvent) => {
      const origin = originRef.current;
      if (origin == null || event.pointerId !== origin.pointerId) {
        return;
      }
      const container = containerRef.current;
      if (draggedRef.current && container?.hasPointerCapture?.(origin.pointerId) === true) {
        container.releasePointerCapture(origin.pointerId);
      }
      reset();
      window.setTimeout(() => {
        draggedRef.current = false;
      }, 0);
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!draggedRef.current) {
        return;
      }
      draggedRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    window.addEventListener('click', onClickCapture, true);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('click', onClickCapture, true);
      reset();
    };
  }, [containerRef, reset]);

  return { onPointerDown, rect, isDragging };
};
