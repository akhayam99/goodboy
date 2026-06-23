import { cloneElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export type TooltipProps = {
  content: string;
  side?: TooltipSide;
  children: React.ReactElement<{
    ref?: React.Ref<HTMLElement>;
    onMouseEnter?: React.MouseEventHandler;
    onMouseLeave?: React.MouseEventHandler;
    onFocus?: React.FocusEventHandler;
    onBlur?: React.FocusEventHandler;
  }>;
};

const GAP = 6;

const assignRef = <T,>(ref: React.Ref<T> | undefined, value: T | null): void => {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref != null) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
};

const flipSide = (side: TooltipSide): TooltipSide => {
  switch (side) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
};

type Coords = { top: number; left: number; side: TooltipSide };

const positionFor = (anchor: DOMRect, tip: DOMRect, side: TooltipSide): Coords => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const place = (s: TooltipSide): { top: number; left: number } => {
    switch (s) {
      case 'top':
        return {
          top: anchor.top - tip.height - GAP,
          left: anchor.left + anchor.width / 2 - tip.width / 2,
        };
      case 'bottom':
        return {
          top: anchor.bottom + GAP,
          left: anchor.left + anchor.width / 2 - tip.width / 2,
        };
      case 'left':
        return {
          top: anchor.top + anchor.height / 2 - tip.height / 2,
          left: anchor.left - tip.width - GAP,
        };
      case 'right':
        return {
          top: anchor.top + anchor.height / 2 - tip.height / 2,
          left: anchor.right + GAP,
        };
    }
  };

  const fits = (s: TooltipSide, p: { top: number; left: number }): boolean => {
    if (s === 'top') {
      return p.top >= 0;
    }
    if (s === 'bottom') {
      return p.top + tip.height <= vh;
    }
    if (s === 'left') {
      return p.left >= 0;
    }
    return p.left + tip.width <= vw;
  };

  let chosen = side;
  let pos = place(side);
  if (!fits(side, pos)) {
    const flipped = flipSide(side);
    const flippedPos = place(flipped);
    if (fits(flipped, flippedPos)) {
      chosen = flipped;
      pos = flippedPos;
    }
  }

  // clamp into viewport on the cross axis
  const left = Math.max(GAP, Math.min(pos.left, vw - tip.width - GAP));
  const top = Math.max(GAP, Math.min(pos.top, vh - tip.height - GAP));
  return { top, left, side: chosen };
};

export const Tooltip = ({ content, side = 'top', children }: TooltipProps) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  const show = () => {
    delayRef.current = setTimeout(() => setVisible(true), 400);
  };

  const hide = () => {
    if (delayRef.current !== null) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    setVisible(false);
    setCoords(null);
  };

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) {
      return;
    }
    setCoords(positionFor(anchor.getBoundingClientRect(), tip.getBoundingClientRect(), side));
  }, [side]);

  useLayoutEffect(() => {
    if (!visible) {
      return;
    }
    reposition();
  }, [visible, content, reposition]);

  // The portaled tip is position:fixed, computed once on show. Keep it pinned to
  // the anchor while visible by re-running on scroll (capture, to catch nested
  // scrollers) and resize.
  useEffect(() => {
    if (!visible) {
      return;
    }
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [visible, reposition]);

  // React 19: ref is a regular prop, available on children.props.ref.
  const childRef = (children.props as { ref?: React.Ref<HTMLElement> }).ref;
  const mergedRef = useCallback(
    (node: HTMLElement | null) => {
      anchorRef.current = node;
      assignRef(childRef, node);
    },
    [childRef],
  );

  const enhanced = cloneElement(children, {
    ref: mergedRef,
    onMouseEnter: (e: React.MouseEvent) => {
      show();
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide();
      children.props.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      show();
      children.props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hide();
      children.props.onBlur?.(e);
    },
  });

  return (
    <>
      {enhanced}
      {visible && typeof document !== 'undefined'
        ? createPortal(
            <span
              ref={tipRef}
              role="tooltip"
              style={{
                position: 'fixed',
                top: coords?.top ?? -9999,
                left: coords?.left ?? -9999,
                visibility: coords ? 'visible' : 'hidden',
              }}
              className={cn(
                'pointer-events-none z-50 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-xs font-medium text-background shadow-sm',
              )}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </>
  );
};
