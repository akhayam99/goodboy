import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '../cn';
import { dismissTopEscapeLayer, registerEscapeLayer } from '../escape';
import { FLOATING_SURFACE } from '../floatingSurface';
import { isKeyboardFocus } from '../isKeyboardFocus';
import { placeFloating, type FloatingCoords, type FloatingSide } from '../placeFloating';
import { glyphsOfShortcut } from '../shortcutGlyphs';
import { TooltipTriggerContext } from '../tooltipTriggerContext';
import { useTooltipDelay } from '../useTooltipDelay';
import { useTooltipQuiet } from '../useTooltipQuiet';
import { TooltipBubble } from './TooltipBubble';

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

const BUBBLE_CLASS = cn(
  'pointer-events-none z-tooltip',
  FLOATING_SURFACE,
  'w-max max-w-70 whitespace-pre-line break-words rounded-md border-border-soft px-2 py-1 text-meta font-medium text-foreground motion-safe:animate-popover-in',
);

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
  const anchorRef = useRef<HTMLElement>(null);
  const { isNested, isQuiet, isQuietNow } = useTooltipQuiet({ isSuppressed, anchorRef });
  const visible = (isHovered || isOpen) && !isQuiet && hasContent;
  const isRestRequired = restDelayMs !== undefined;
  const [coords, setCoords] = useState<FloatingCoords | null>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const identityRef = useRef({});
  const isPointerDownRef = useRef(false);
  const suppressionEndedAtRef = useRef(Number.NEGATIVE_INFINITY);

  const { isPendingRef, clearDelay, startDelay, open } = useTooltipDelay({
    isQuietNow,
    restDelayMs,
    setIsHovered,
  });

  const show = () => {
    isPendingRef.current = true;
    clearDelay();
    if (isQuietNow()) {
      return;
    }
    if (!isRestRequired && isWarm()) {
      setIsHovered(true);
      return;
    }
    startDelay();
  };

  const markClosed = () => {
    lastClosedAt = Date.now();
    lastCloser = identityRef.current;
  };

  const hide = () => {
    isPendingRef.current = false;
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
    if (isRestRequired) {
      return;
    }
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      return;
    }
    if (Date.now() - suppressionEndedAtRef.current < REFOCUS_WINDOW_MS) {
      return;
    }
    if (!isKeyboardFocus({ target }) || isQuietNow()) {
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
  }, [clearDelay]);

  const wasQuietRef = useRef(isQuiet);
  useEffect(() => {
    if (isQuiet) {
      clearDelay();
      setIsHovered(false);
      setCoords(null);
    }
    if (wasQuietRef.current && !isQuiet) {
      suppressionEndedAtRef.current = Date.now();
      if (isPendingRef.current) {
        startDelay();
      }
    }
    wasQuietRef.current = isQuiet;
  }, [clearDelay, isPendingRef, isQuiet, startDelay]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const unregister = registerEscapeLayer(() => {
      unregister();
      isPendingRef.current = false;
      clearDelay();
      markClosed();
      setIsHovered(false);
      setCoords(null);
      dismissTopEscapeLayer();
    });
    return unregister;
  }, [clearDelay, isPendingRef, visible]);

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
      isPendingRef.current = false;
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
  }, [clearDelay, isPendingRef, visible, isOpen, reposition]);

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

  if (isNested) {
    return children;
  }

  return (
    <TooltipTriggerContext.Provider value={hasContent && !isSuppressed}>
      {enhanced}
      {visible && portalTarget !== null ? (
        <TooltipBubble
          tipRef={tipRef}
          tipId={tipId}
          coords={coords}
          content={content}
          keys={keys}
          target={portalTarget}
          className={BUBBLE_CLASS}
        />
      ) : null}
    </TooltipTriggerContext.Provider>
  );
};
