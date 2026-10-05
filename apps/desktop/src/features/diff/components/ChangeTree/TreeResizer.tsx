import { useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { clampTreeWidth, TREE_WIDTH_MAX, TREE_WIDTH_MIN } from '../../hooks/useTreeWidth';

const KEY_STEP = 16;

type Props = {
  readonly asideRef: RefObject<HTMLElement | null>;
  readonly width: number;
  readonly paneWidth: () => number;
  readonly onResize: (width: number) => void;
};

export const TreeResizer = ({ asideRef, width, paneWidth, onResize }: Props) => {
  const drag = useRef<{ readonly x: number; readonly width: number } | null>(null);
  const live = useRef(width);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const aside = asideRef.current;
    if (aside === null) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    live.current = aside.getBoundingClientRect().width;
    drag.current = { x: event.clientX, width: live.current };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const aside = asideRef.current;
    if (start === null || aside === null) {
      return;
    }
    live.current = clampTreeWidth(start.width + event.clientX - start.x, paneWidth());
    aside.style.width = `${live.current}px`;
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current === null) {
      return;
    }
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onResize(live.current);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    onResize(width + (event.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize file tree"
      aria-valuemin={TREE_WIDTH_MIN}
      aria-valuemax={TREE_WIDTH_MAX}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      className="group/resizer absolute inset-y-0 right-0 z-10 w-2 translate-x-1/2 cursor-col-resize touch-none focus-visible:outline-none"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover/resizer:bg-border group-focus-visible/resizer:bg-focus-ring"
      />
    </div>
  );
};
