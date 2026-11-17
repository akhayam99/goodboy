import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { cn } from '../cn';
import type { ResizeActivity } from '../sheet';

type Side = 'left' | 'right' | 'top' | 'bottom';

type Axis = 'x' | 'y';

export type SplitHandleProps = {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (size: number) => void;
  readonly onCommit?: (size: number) => void;
  readonly onReset?: () => void;
  readonly side?: Side;
  readonly ariaLabel: string;
  readonly onActivityChange?: (activity: ResizeActivity) => void;
  readonly shouldDrawEdge?: boolean;
};

type DragState = {
  readonly startValue: number;
  readonly startPoint: number;
};

type AxisShape = {
  readonly orientation: 'vertical' | 'horizontal';
  readonly cursor: 'col-resize' | 'row-resize';
  readonly bar: string;
  readonly edge: string;
  readonly arrows: readonly [string, string];
};

const AXIS_OF = {
  left: 'x',
  right: 'x',
  top: 'y',
  bottom: 'y',
} as const satisfies Record<Side, Axis>;

const GROWTH_OF = {
  left: 1,
  right: -1,
  top: 1,
  bottom: -1,
} as const satisfies Record<Side, number>;

const SHAPE_OF = {
  x: {
    orientation: 'vertical',
    cursor: 'col-resize',
    bar: 'h-full w-1.5 cursor-col-resize',
    edge: 'inset-y-0 left-1/2 w-px -translate-x-1/2',
    arrows: ['ArrowLeft', 'ArrowRight'],
  },
  y: {
    orientation: 'horizontal',
    cursor: 'row-resize',
    bar: 'h-1.5 w-full cursor-row-resize',
    edge: 'inset-x-0 top-1/2 h-px -translate-y-1/2',
    arrows: ['ArrowUp', 'ArrowDown'],
  },
} as const satisfies Record<Axis, AxisShape>;

type ClampParams = {
  readonly value: number;
  readonly min: number;
  readonly max: number;
};

const clamp = ({ value, min, max }: ClampParams): number => Math.max(min, Math.min(max, value));

type PointParams = {
  readonly event: globalThis.MouseEvent | MouseEvent<HTMLDivElement>;
  readonly axis: Axis;
};

const pointOf = ({ event, axis }: PointParams): number =>
  axis === 'x' ? event.clientX : event.clientY;

type KeyDirectionParams = {
  readonly key: string;
  readonly shape: AxisShape;
};

const keyDirectionOf = ({ key, shape }: KeyDirectionParams): number => {
  const [back, forward] = shape.arrows;
  if (key === back) {
    return -1;
  }
  if (key === forward) {
    return 1;
  }
  return 0;
};

type StartDragParams = {
  readonly event: MouseEvent<HTMLDivElement>;
};

type HoverParams = {
  readonly isHovered: boolean;
};

type StepParams = {
  readonly event: KeyboardEvent<HTMLDivElement>;
};

export const SplitHandle = ({
  value,
  min,
  max,
  onChange,
  onCommit,
  onReset,
  side = 'left',
  ariaLabel,
  onActivityChange,
  shouldDrawEdge = true,
}: SplitHandleProps) => {
  const axis = AXIS_OF[side];
  const growth = GROWTH_OF[side];
  const shape = SHAPE_OF[axis];
  const dragStateRef = useRef<DragState | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const liveValueRef = useRef(value);
  liveValueRef.current = dragStateRef.current === null ? value : liveValueRef.current;
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const isHoveredRef = useRef(false);
  const activityRef = useRef(onActivityChange);
  activityRef.current = onActivityChange;

  const report = () => {
    if (dragStateRef.current !== null) {
      activityRef.current?.('drag');
      return;
    }
    activityRef.current?.(isHoveredRef.current ? 'hover' : 'idle');
  };

  useEffect(() => {
    const listeners = new AbortController();
    window.addEventListener(
      'mousemove',
      (event) => {
        const dragState = dragStateRef.current;
        if (dragState === null) {
          return;
        }
        event.preventDefault();
        const next = clamp({
          value: dragState.startValue + (pointOf({ event, axis }) - dragState.startPoint) * growth,
          min,
          max,
        });
        if (next === liveValueRef.current) {
          return;
        }
        liveValueRef.current = next;
        handleRef.current?.setAttribute('aria-valuenow', String(next));
        onChange(next);
      },
      { signal: listeners.signal },
    );
    window.addEventListener(
      'mouseup',
      () => {
        if (dragStateRef.current === null) {
          return;
        }
        dragStateRef.current = null;
        commitRef.current?.(liveValueRef.current);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        report();
      },
      { signal: listeners.signal },
    );
    return () => {
      listeners.abort();
      if (dragStateRef.current !== null) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, [axis, growth, max, min, onChange]);

  const startDrag = ({ event }: StartDragParams) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    dragStateRef.current = {
      startValue: value,
      startPoint: pointOf({ event, axis }),
    };
    liveValueRef.current = value;
    document.body.style.cursor = shape.cursor;
    document.body.style.userSelect = 'none';
    report();
  };

  const setHovered = ({ isHovered }: HoverParams) => {
    isHoveredRef.current = isHovered;
    report();
  };

  const step = ({ event }: StepParams) => {
    const direction = keyDirectionOf({ key: event.key, shape });
    if (direction === 0) {
      return;
    }
    event.preventDefault();
    const size = event.shiftKey ? 32 : 8;
    const next = clamp({ value: value + size * direction * growth, min, max });
    onChange(next);
    onCommit?.(next);
  };

  return (
    <div
      ref={handleRef}
      role="separator"
      aria-orientation={shape.orientation}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onMouseDown={(event) => startDrag({ event })}
      onMouseEnter={() => setHovered({ isHovered: true })}
      onMouseLeave={() => setHovered({ isHovered: false })}
      onKeyDown={(event) => step({ event })}
      onDoubleClick={onReset}
      className={cn(
        'group relative shrink-0 select-none overflow-hidden focus-visible:outline-none',
        shape.bar,
      )}
    >
      <div
        data-edge={shouldDrawEdge ? 'line' : 'owner'}
        className={cn(
          'pointer-events-none absolute bg-primary opacity-0 motion-safe:transition-opacity group-focus-visible:opacity-100',
          shape.edge,
          shouldDrawEdge && 'bg-border group-hover:opacity-100 group-focus-visible:bg-primary',
        )}
      />
    </div>
  );
};
