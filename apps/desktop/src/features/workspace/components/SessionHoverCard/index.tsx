import { useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FLOATING_SURFACE,
  POPOVER_WIDTH_PX,
  cn,
  useEscapeLayer,
  useFloatingPlace,
  useHoverSurface,
} from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { SessionHoverCardBody } from './SessionHoverCardBody';

const CARD_WIDTH = POPOVER_WIDTH_PX.standard;
const GAP = 8;
const EDGE = 8;

type Props = {
  readonly session: Session | null;
  readonly isArchived: boolean;
  readonly anchor: HTMLElement | null;
  readonly boundary: HTMLElement | null;
  readonly onKeep: () => void;
  readonly onLeave: () => void;
  readonly onClose: () => void;
};

export const SessionHoverCard = ({
  session,
  isArchived,
  anchor,
  boundary,
  onKeep,
  onLeave,
  onClose,
}: Props) => {
  const isShown = session !== null && anchor !== null;
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEscapeLayer(onClose, isShown);
  useHoverSurface({ isActive: isShown });
  const place = useFloatingPlace({
    anchor,
    clearOf: boundary,
    tipRef: cardRef,
    isActive: isShown,
    side: 'right',
    alignment: 'start',
    gap: GAP,
    edge: EDGE,
    contentKey: session === null ? undefined : session.id,
  });

  if (!isShown) {
    return null;
  }

  return createPortal(
    <div
      ref={cardRef}
      role="tooltip"
      data-testid="session-hover-card"
      data-hover-surface=""
      onMouseEnter={onKeep}
      onMouseLeave={onLeave}
      style={{
        position: 'fixed',
        width: CARD_WIDTH,
        top: place === null ? 0 : place.top,
        left: place === null ? 0 : place.left,
        visibility: place === null ? 'hidden' : 'visible',
      }}
      className={cn(
        FLOATING_SURFACE,
        'z-popover p-3 text-meta',
        place !== null && 'motion-safe:animate-popover-in',
      )}
    >
      <SessionHoverCardBody session={session} isArchived={isArchived} />
    </div>,
    document.body,
  );
};
