import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FLOATING_SURFACE, ScrollFade, cn, useEscapeLayer } from '@goodboy/ui';
import type { RailFlyoutTarget } from './useRailFlyout';

const FLYOUT_WIDTH = 288;
const GAP = 8;
const EDGE = 8;

type Place = {
  readonly top: number;
  readonly left: number;
};

type Props = {
  readonly target: RailFlyoutTarget | null;
  readonly label: string;
  readonly onKeep: () => void;
  readonly onLeave: () => void;
  readonly onClose: () => void;
  readonly onDismiss: () => void;
  readonly children: ReactNode;
};

const BUTTONS = 'button:not([disabled])';

export const RailFlyout = ({
  target,
  label,
  onKeep,
  onLeave,
  onClose,
  onDismiss,
  children,
}: Props) => {
  const isShown = target !== null;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  useEscapeLayer(onDismiss, isShown);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (target === null || card === null) {
      setPlace(null);
      return;
    }
    const anchorRect = target.anchor.getBoundingClientRect();
    const height = card.getBoundingClientRect().height;
    const maxTop = Math.max(EDGE, window.innerHeight - height - EDGE);
    setPlace({
      left: anchorRect.right + GAP,
      top: Math.min(Math.max(EDGE, anchorRect.top - GAP), maxTop),
    });
  }, [target]);

  if (target === null) {
    return null;
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onDismiss();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    event.preventDefault();
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(BUTTONS));
    const index = rows.findIndex((row) => row === document.activeElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const next = rows[Math.max(0, Math.min(rows.length - 1, index + step))];
    next?.focus();
    next?.scrollIntoView({ block: 'nearest' });
  };

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label={label}
      data-rail-flyout={target.key}
      onMouseEnter={onKeep}
      onMouseLeave={onLeave}
      onFocus={onKeep}
      onBlur={onLeave}
      onClick={onClose}
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed',
        width: FLYOUT_WIDTH,
        maxHeight: window.innerHeight - 2 * EDGE,
        top: place?.top ?? 0,
        left: place?.left ?? 0,
        visibility: place === null ? 'hidden' : 'visible',
      }}
      className={cn(
        FLOATING_SURFACE,
        'z-popover flex flex-col p-2 text-label',
        place !== null && 'motion-safe:animate-popover-in',
      )}
    >
      <ScrollFade
        className="max-h-[inherit]"
        viewportClassName="flex flex-col gap-1"
        fadeFrom="floating"
        fadeSize={16}
      >
        {children}
      </ScrollFade>
    </div>,
    document.body,
  );
};
