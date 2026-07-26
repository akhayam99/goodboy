import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react';

export type ResizeHandleProps = {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (width: number) => void;
  readonly onReset?: () => void;
  readonly side?: 'left' | 'right';
  readonly ariaLabel: string;
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
  onReset,
  side = 'left',
  ariaLabel,
}: ResizeHandleProps) => {
  const dragStateRef = useRef<DragState | null>(null);

  useEffect(() => {
    const onMove = (event: globalThis.MouseEvent) => {
      const dragState = dragStateRef.current;
      if (dragState === null) {
        return;
      }
      event.preventDefault();
      const direction = side === 'left' ? 1 : -1;
      onChange(
        clamp({
          value: dragState.startValue + (event.clientX - dragState.startX) * direction,
          min,
          max,
        }),
      );
    };
    const onUp = () => {
      if (dragStateRef.current === null) {
        return;
      }
      dragStateRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
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
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? 32 : 8;
    const keyDirection = event.key === 'ArrowLeft' ? -1 : 1;
    const sideDirection = side === 'left' ? 1 : -1;
    onChange(
      clamp({
        value: value + step * keyDirection * sideDirection,
        min,
        max,
      }),
    );
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
      className="group relative h-full w-1.5 shrink-0 cursor-col-resize select-none overflow-hidden focus-visible:outline-none"
    >
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-border-soft to-transparent transition-colors group-hover:via-border group-focus-visible:via-primary" />
    </div>
  );
};
