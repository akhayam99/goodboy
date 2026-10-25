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
import { assignRef } from '../../assignRef';
import { cn } from '../../cn';
import { dismissTopEscapeLayer, registerEscapeLayer } from '../../escape';
import { FLOATING_SURFACE } from '../../floatingSurface';
import { isKeyboardFocus } from '../../isKeyboardFocus';
import { placeFloating, type FloatingCoords, type FloatingSide } from '../../placeFloating';
import { useRestHover } from '../../useRestHover';
import { FactCardBody } from './FactCardBody';
import { factCardSentence } from './factCardSentence';
import type { FactCardSpec } from './types';

const GAP = 8;
const EDGE = 8;

type Props = {
  readonly card: FactCardSpec;
  readonly side?: FloatingSide;
  readonly isOpen?: boolean;
  readonly isSuppressed?: boolean;
  readonly isTapOpen?: boolean;
  readonly isFocusRested?: boolean;
  readonly children: React.ReactElement<{
    ref?: React.Ref<HTMLElement>;
    'aria-describedby'?: string;
    onPointerEnter?: React.PointerEventHandler;
    onPointerLeave?: React.PointerEventHandler;
    onPointerDown?: React.PointerEventHandler;
    onClick?: React.MouseEventHandler;
    onFocus?: React.FocusEventHandler;
    onBlur?: React.FocusEventHandler;
  }>;
};

export const FactCard = ({
  card,
  side = 'bottom',
  isOpen = false,
  isSuppressed = false,
  isTapOpen = false,
  isFocusRested = false,
  children,
}: Props) => {
  const { target, enter, openNow, leave, close } = useRestHover<HTMLElement>({
    hasWarmWindow: true,
  });
  const anchorRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const isTouchRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const [coords, setCoords] = useState<FloatingCoords | null>(null);
  const sentenceId = useId();
  const sentence = factCardSentence({ card });
  const isHovered = target !== null;
  const isShown = (isHovered || isOpen) && !isSuppressed;

  useEffect(() => {
    if (!isHovered) {
      return;
    }
    const unregister = registerEscapeLayer(() => {
      unregister();
      close();
      dismissTopEscapeLayer();
    });
    return unregister;
  }, [isHovered, close]);

  useEffect(() => {
    if (isSuppressed) {
      close();
    }
  }, [isSuppressed, close]);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const tip = cardRef.current;
    if (anchor === null || tip === null) {
      return;
    }
    setCoords(
      placeFloating({
        anchor: anchor.getBoundingClientRect(),
        tip: tip.getBoundingClientRect(),
        side,
        gap: GAP,
        edge: EDGE,
      }),
    );
  }, [side]);

  useLayoutEffect(() => {
    if (!isShown) {
      setCoords(null);
      return;
    }
    reposition();
  }, [isShown, card, reposition]);

  useEffect(() => {
    if (!isShown) {
      return;
    }
    const onScroll = () => {
      if (isOpen) {
        reposition();
        return;
      }
      close();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isShown, isOpen, reposition, close]);

  useEffect(() => {
    if (!isTapOpen || !isHovered) {
      return;
    }
    const onOutside = (event: PointerEvent) => {
      const anchor = anchorRef.current;
      if (anchor !== null && event.target instanceof Node && anchor.contains(event.target)) {
        return;
      }
      close();
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [isTapOpen, isHovered, close]);

  const childRef = children.props.ref;
  const mergedRef = useCallback(
    (node: HTMLElement | null) => {
      anchorRef.current = node;
      assignRef({ ref: childRef, value: node });
    },
    [childRef],
  );

  const onPointerEnter = (event: React.PointerEvent) => {
    children.props.onPointerEnter?.(event);
    const anchor = anchorRef.current;
    if (event.pointerType === 'touch' || isSuppressed || anchor === null) {
      return;
    }
    enter(anchor);
  };

  const onPointerLeave = (event: React.PointerEvent) => {
    children.props.onPointerLeave?.(event);
    isPointerDownRef.current = false;
    if (event.pointerType === 'touch') {
      return;
    }
    leave();
  };

  const onPointerDown = (event: React.PointerEvent) => {
    children.props.onPointerDown?.(event);
    isTouchRef.current = event.pointerType === 'touch';
    isPointerDownRef.current = true;
    if (!isTouchRef.current) {
      close();
    }
  };

  const onClick = (event: React.MouseEvent) => {
    children.props.onClick?.(event);
    const anchor = anchorRef.current;
    if (!isTapOpen || !isTouchRef.current || anchor === null) {
      return;
    }
    isTouchRef.current = false;
    if (isHovered) {
      close();
      return;
    }
    openNow(anchor);
  };

  const onFocus = (event: React.FocusEvent) => {
    children.props.onFocus?.(event);
    const anchor = anchorRef.current;
    if (isSuppressed || anchor === null) {
      return;
    }
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      return;
    }
    if (!isKeyboardFocus({ target: event.target })) {
      return;
    }
    if (isFocusRested) {
      enter(anchor);
      return;
    }
    openNow(anchor);
  };

  const onBlur = (event: React.FocusEvent) => {
    children.props.onBlur?.(event);
    isPointerDownRef.current = false;
    close();
  };

  const ownDescribedBy = children.props['aria-describedby'];
  const describedBy = [ownDescribedBy, sentenceId]
    .filter((id): id is string => id !== undefined)
    .join(' ');
  const portalTarget =
    typeof document === 'undefined'
      ? null
      : (anchorRef.current?.closest('dialog[open]') ?? document.body);

  return (
    <>
      {cloneElement(children, {
        ref: mergedRef,
        'aria-describedby': describedBy,
        onPointerEnter,
        onPointerLeave,
        onPointerDown,
        onClick,
        onFocus,
        onBlur,
      })}
      <span id={sentenceId} className="sr-only">
        {sentence}
      </span>
      {isShown && portalTarget !== null
        ? createPortal(
            <div
              ref={cardRef}
              aria-hidden
              data-testid="fact-card"
              style={{
                position: 'fixed',
                top: coords?.top ?? -9999,
                left: coords?.left ?? -9999,
                visibility: coords === null ? 'hidden' : 'visible',
              }}
              className={cn(
                FLOATING_SURFACE,
                'pointer-events-none z-tooltip w-80 p-3 text-meta',
                coords !== null && 'motion-safe:animate-popover-in',
              )}
            >
              <FactCardBody card={card} />
            </div>,
            portalTarget,
          )
        : null}
    </>
  );
};
