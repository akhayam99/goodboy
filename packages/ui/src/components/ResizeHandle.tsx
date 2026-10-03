import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { cn } from '../cn';
import type { ResizeActivity } from '../sheet';

export type ResizeHandleProps = {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (width: number) => void;
  readonly onCommit?: (width: number) => void;
  readonly onReset?: () => void;
  readonly side?: 'left' | 'right';
  readonly ariaLabel: string;
  readonly onActivityChange?: (activity: ResizeActivity) => void;
  readonly drawsEdge?: boolean;
};

type DragState = {
  readonly startValue: number;
  readonly startX: number;
};

type ClampParams = {
  readonly value: number;
  readonly min: number;
  readonly max: number;
};

const clamp = ({ value, min, max }: ClampParams): number => Math.max(min, Math.min(max, value));

export const ResizeHandle = ({
  value,
  min,
  max,
  onChange,
  onCommit,
  onReset,
  side = 'left',
  ariaLabel,
  onActivityChange,
  drawsEdge = true,
}: ResizeHandleProps) => {
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
    const onMove = (event: globalThis.MouseEvent) => {
      const dragState = dragStateRef.current;
      if (dragState === null) {
        return;
      }
      event.preventDefault();
      const direction = side === 'left' ? 1 : -1;
      const next = clamp({
        value: dragState.startValue + (event.clientX - dragState.startX) * direction,
        min,
        max,
      });
      if (next === liveValueRef.current) {
        return;
      }
      liveValueRef.current = next;
      handleRef.current?.setAttribute('aria-valuenow', String(next));
      onChange(next);
    };
    const onUp = () => {
      if (dragStateRef.current === null) {
        return;
      }
      dragStateRef.current = null;
      commitRef.current?.(liveValueRef.current);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      report();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (dragStateRef.current !== null) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, [max, min, onChange, side]);

  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    dragStateRef.current = {
      startValue: value,
      startX: event.clientX,
    };
    liveValueRef.current = value;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    report();
  };

  const onHoverChange = (isHovered: boolean) => {
    isHoveredRef.current = isHovered;
    report();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? 32 : 8;
    const keyDirection = event.key === 'ArrowLeft' ? -1 : 1;
    const sideDirection = side === 'left' ? 1 : -1;
    const next = clamp({
      value: value + step * keyDirection * sideDirection,
      min,
      max,
    });
    onChange(next);
    onCommit?.(next);
  };

  return (
    <div
      ref={handleRef}
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onMouseDown={onMouseDown}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
      className="group relative h-full w-1.5 shrink-0 cursor-col-resize select-none overflow-hidden focus-visible:outline-none"
    >
      <div
        data-edge={drawsEdge ? 'line' : 'owner'}
        className={cn(
          'pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-primary opacity-0 motion-safe:transition-opacity group-focus-visible:opacity-100',
          drawsEdge && 'bg-border group-hover:opacity-100 group-focus-visible:bg-primary',
        )}
      />
    </div>
  );
};
