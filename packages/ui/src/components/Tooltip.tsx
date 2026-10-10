import { cloneElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';
import { dismissTopEscapeLayer, registerEscapeLayer } from '../escape';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export type TooltipVariant = 'label' | 'card';

export type TooltipProps = {
  content: React.ReactNode;
  variant?: TooltipVariant;
  side?: TooltipSide;
  anchorClassName?: string;
  restDelayMs?: number;
  isOpen?: boolean;
  isSuppressed?: boolean;
  children: React.ReactElement<{
    ref?: React.Ref<HTMLElement>;
    disabled?: boolean;
    onMouseEnter?: React.MouseEventHandler;
    onMouseMove?: React.MouseEventHandler;
    onMouseLeave?: React.MouseEventHandler;
    onPointerDown?: React.PointerEventHandler;
    onFocus?: React.FocusEventHandler;
    onBlur?: React.FocusEventHandler;
  }>;
};

const GAP = 6;

const DEFAULT_DELAY_MS = 400;

const WARM_WINDOW_MS = 300;

const REFOCUS_WINDOW_MS = 200;

let lastClosedAt = Number.NEGATIVE_INFINITY;

let lastCloser: object | null = null;

const isKeyboardFocus = (target: EventTarget): boolean => {
  if (!(target instanceof Element)) {
    return true;
  }
  try {
    return target.matches(':focus-visible');
  } catch {
    return true;
  }
};

const isWarm = (): boolean => Date.now() - lastClosedAt < WARM_WINDOW_MS;

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

  const left = Math.max(GAP, Math.min(pos.left, vw - tip.width - GAP));
  const top = Math.max(GAP, Math.min(pos.top, vh - tip.height - GAP));
  return { top, left, side: chosen };
};

export const Tooltip = ({
  content,
  variant = 'label',
  side = 'top',
  anchorClassName,
  restDelayMs,
  isOpen = false,
  isSuppressed = false,
  children,
}: TooltipProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const visible = (isHovered || isOpen) && !isSuppressed;
  const isRestRequired = restDelayMs !== undefined;
  const [coords, setCoords] = useState<Coords | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const identityRef = useRef({});
  const isPointerDownRef = useRef(false);
  const suppressionEndedAtRef = useRef(Number.NEGATIVE_INFINITY);

  const clearDelay = () => {
    if (delayRef.current === null) {
      return;
    }
    clearTimeout(delayRef.current);
    delayRef.current = null;
  };

  const open = () => {
    clearDelay();
    setIsHovered(true);
  };

  const show = () => {
    if (isSuppressed) {
      return;
    }
    clearDelay();
    if (!isRestRequired && isWarm()) {
      setIsHovered(true);
      return;
    }
    delayRef.current = setTimeout(() => {
      delayRef.current = null;
      setIsHovered(true);
    }, restDelayMs ?? DEFAULT_DELAY_MS);
  };

  const markClosed = () => {
    lastClosedAt = Date.now();
    lastCloser = identityRef.current;
  };

  const hide = () => {
    clearDelay();
    if (isHovered) {
      markClosed();
    }
    setIsHovered(false);
    setCoords(null);
  };

  const leave = () => {
    isPointerDownRef.current = false;
    hide();
  };

  const press = () => {
    isPointerDownRef.current = true;
    hide();
  };

  const rest = () => {
    if (!isRestRequired || isHovered) {
      return;
    }
    show();
  };

  const focus = (target: EventTarget) => {
    if (isRestRequired || isSuppressed) {
      return;
    }
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      return;
    }
    if (Date.now() - suppressionEndedAtRef.current < REFOCUS_WINDOW_MS) {
      return;
    }
    if (!isKeyboardFocus(target)) {
      show();
      return;
    }
    open();
  };

  const blur = () => {
    isPointerDownRef.current = false;
    hide();
  };

  useEffect(() => {
    const identity = identityRef.current;
    return () => {
      clearDelay();
      if (lastCloser === identity) {
        lastCloser = null;
        lastClosedAt = Number.NEGATIVE_INFINITY;
      }
    };
  }, []);

  const wasSuppressedRef = useRef(isSuppressed);
  useEffect(() => {
    if (isSuppressed) {
      clearDelay();
      setIsHovered(false);
      setCoords(null);
    }
    if (wasSuppressedRef.current && !isSuppressed) {
      suppressionEndedAtRef.current = Date.now();
    }
    wasSuppressedRef.current = isSuppressed;
  }, [isSuppressed]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const unregister = registerEscapeLayer(() => {
      unregister();
      clearDelay();
      markClosed();
      setIsHovered(false);
      setCoords(null);
      dismissTopEscapeLayer();
    });
    return unregister;
  }, [visible]);

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

  const childRef = (children.props as { ref?: React.Ref<HTMLElement> }).ref;
  const mergedRef = useCallback(
    (node: HTMLElement | null) => {
      anchorRef.current = node;
      assignRef(childRef, node);
    },
    [childRef],
  );

  const isTriggerDisabled = children.props.disabled;
  const canTriggerBeDisabled = isTriggerDisabled !== undefined;
  const hasAnchor = canTriggerBeDisabled || anchorClassName !== undefined;

  const enhanced = hasAnchor ? (
    <span
      className={cn(
        'inline-flex',
        isTriggerDisabled === true && 'cursor-not-allowed [&_:disabled]:pointer-events-none',
        anchorClassName,
      )}
      onMouseEnter={show}
      onMouseMove={rest}
      onMouseLeave={leave}
      onPointerDown={press}
      onFocus={(e) => focus(e.target)}
      onBlur={blur}
    >
      {cloneElement(children, { ref: mergedRef })}
    </span>
  ) : (
    cloneElement(children, {
      ref: mergedRef,
      onMouseEnter: (e: React.MouseEvent) => {
        show();
        children.props.onMouseEnter?.(e);
      },
      onMouseMove: (e: React.MouseEvent) => {
        rest();
        children.props.onMouseMove?.(e);
      },
      onMouseLeave: (e: React.MouseEvent) => {
        leave();
        children.props.onMouseLeave?.(e);
      },
      onPointerDown: (e: React.PointerEvent) => {
        press();
        children.props.onPointerDown?.(e);
      },
      onFocus: (e: React.FocusEvent) => {
        focus(e.target);
        children.props.onFocus?.(e);
      },
      onBlur: (e: React.FocusEvent) => {
        blur();
        children.props.onBlur?.(e);
      },
    })
  );
  const portalTarget =
    typeof document === 'undefined'
      ? null
      : (anchorRef.current?.closest('dialog[open]') ?? document.body);

  return (
    <>
      {enhanced}
      {visible && portalTarget !== null
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
                'pointer-events-none z-tooltip',
                variant === 'label' &&
                  'whitespace-nowrap rounded-sm bg-foreground px-2 py-0.5 text-label font-medium text-background shadow-sm',
                variant === 'card' &&
                  'w-65 rounded-md border border-border-soft bg-elevated p-3 text-label text-foreground shadow-md',
              )}
            >
              {content}
            </span>,
            portalTarget,
          )
        : null}
    </>
  );
};
