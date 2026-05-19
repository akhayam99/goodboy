import { useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: string;
  side?: TooltipSide;
  children: ReactNode;
}

const SIDE_CLASSES: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
};

export function Tooltip({ content, side = 'top', children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const show = () => {
    delayRef.current = setTimeout(() => setVisible(true), 400);
  };

  const hide = () => {
    if (delayRef.current !== null) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    setVisible(false);
  };

  // Previously this component used `cloneElement` to inject event handlers
  // and aria-describedby into the consumer's child. React 19 discourages that
  // pattern (no static type for "the child accepts these props") so we wrap
  // the child in a span instead — the trigger element still owns its own
  // role/markup, and screen readers get a real `aria-describedby` link.
  return (
    <span className="relative inline-flex">
      {visible ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-xs font-medium text-background shadow-sm',
            SIDE_CLASSES[side],
          )}
        >
          {content}
        </span>
      ) : null}
      <span
        aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="contents"
      >
        {children}
      </span>
    </span>
  );
}
