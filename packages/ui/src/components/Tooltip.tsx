import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';
import { dismissTopEscapeLayer, registerEscapeLayer } from '../escape';
import { FLOATING_SURFACE } from '../floatingSurface';
import { isKeyboardFocus } from '../isKeyboardFocus';
import { placeFloating, type FloatingCoords, type FloatingSide } from '../placeFloating';
import { glyphsOfShortcut } from '../shortcutGlyphs';
import { Kbd } from './Kbd';

export type TooltipSide = FloatingSide;

export type TooltipProps = {
  content: React.ReactNode;
  shortcut?: string;
  side?: TooltipSide;
  anchorClassName?: string;
  restDelayMs?: number;
  isOpen?: boolean;
  isSuppressed?: boolean;
  children: React.ReactElement<{
    ref?: React.Ref<HTMLElement>;
    disabled?: boolean;
    'aria-label'?: string;
    'aria-describedby'?: string;
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

const isWarm = (): boolean => Date.now() - lastClosedAt < WARM_WINDOW_MS;

const assignRef = <T,>(ref: React.Ref<T> | undefined, value: T | null): void => {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref != null) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
};

export const Tooltip = ({
  content,
  shortcut,
  side = 'top',
  anchorClassName,
  restDelayMs,
  isOpen = false,
  isSuppressed = false,
  children,
}: TooltipProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const hasContent =
    content !== undefined && content !== null && content !== false && content !== '';
  const visible = (isHovered || isOpen) && !isSuppressed && hasContent;
  const isRestRequired = restDelayMs !== undefined;
  const [coords, setCoords] = useState<FloatingCoords | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();
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
    if (!isKeyboardFocus({ target })) {
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
    setCoords(
      placeFloating({
        anchor: anchor.getBoundingClientRect(),
        tip: tip.getBoundingClientRect(),
        side,
        gap: GAP,
        edge: GAP,
      }),
    );
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
    const closeOnScroll = () => {
      if (isOpen) {
        reposition();
        return;
      }
      clearDelay();
      setIsHovered(false);
      setCoords(null);
    };
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', reposition);
    };
  }, [visible, isOpen, reposition]);

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

  const triggerName = children.props['aria-label'];
  const isNameRepeated = typeof content === 'string' && content === triggerName;
  const ownDescribedBy = children.props['aria-describedby'];
  const describedBy =
    visible && !isNameRepeated
      ? [ownDescribedBy, tipId].filter((id): id is string => id !== undefined).join(' ')
      : ownDescribedBy;

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
      {cloneElement(children, { ref: mergedRef, 'aria-describedby': describedBy })}
    </span>
  ) : (
    cloneElement(children, {
      ref: mergedRef,
      'aria-describedby': describedBy,
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
  const keys = shortcut === undefined ? '' : glyphsOfShortcut({ id: shortcut });
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
              id={tipId}
              role="tooltip"
              style={{
                position: 'fixed',
                top: coords?.top ?? -9999,
                left: coords?.left ?? -9999,
                visibility: coords ? 'visible' : 'hidden',
              }}
              className={cn(
                'pointer-events-none z-tooltip',
                FLOATING_SURFACE,
                'w-max max-w-70 whitespace-pre-line break-words rounded-md border-border-soft px-2 py-1 text-meta font-medium text-foreground motion-safe:animate-popover-in',
              )}
            >
              {keys === '' ? (
                content
              ) : (
                <span className="inline-flex items-baseline gap-2">
                  <span>{content}</span>
                  <Kbd>{keys}</Kbd>
                </span>
              )}
            </span>,
            portalTarget,
          )
        : null}
    </>
  );
};
