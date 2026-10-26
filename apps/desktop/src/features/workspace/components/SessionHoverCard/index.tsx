import { useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FLOATING_SURFACE,
  POPOVER_WIDTH_PX,
  cn,
  useEscapeLayer,
  useFloatingPlace,
} from '@goodboy/ui';
import type { Session, SessionAttentionReason, SessionId } from '@goodboy/types';
import { openGuideChapter } from '../../../settings/openGuideChapter';
import { SessionHoverCardBody } from './SessionHoverCardBody';

const CARD_WIDTH = POPOVER_WIDTH_PX.standard;
const GAP = 8;
const EDGE = 8;

type OpenAttention = {
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | null;
};

type Props = {
  readonly session: Session | null;
  readonly isArchived: boolean;
  readonly anchor: HTMLElement | null;
  readonly boundary: HTMLElement | null;
  readonly onKeep: () => void;
  readonly onLeave: () => void;
  readonly onClose: () => void;
  readonly onOpenAttention: (params: OpenAttention) => void;
  readonly isFactsOnly?: boolean;
};

export const SessionHoverCard = ({
  session,
  isArchived,
  anchor,
  boundary,
  onKeep,
  onLeave,
  onClose,
  onOpenAttention,
  isFactsOnly = false,
}: Props) => {
  const isShown = session !== null && anchor !== null;
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEscapeLayer(onClose, isShown);
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
      <SessionHoverCardBody
        session={session}
        isArchived={isArchived}
        isFactsOnly={isFactsOnly}
        onOpenAttention={onOpenAttention}
        onOpenLegend={() => {
          openGuideChapter({ id: 'legend' });
          onClose();
        }}
      />
    </div>,
    document.body,
  );
};
