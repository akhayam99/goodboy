import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FLOATING_SURFACE, cn, useEscapeLayer } from '@goodboy/ui';
import type { Session, SessionAttentionReason, SessionId } from '@goodboy/types';
import { openGuideChapter } from '../../../settings/openGuideChapter';
import { SessionHoverCardBody } from './SessionHoverCardBody';

const CARD_WIDTH = 320;
const GAP = 8;
const EDGE = 8;

type Place = {
  readonly top: number;
  readonly left: number;
};

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
  const [place, setPlace] = useState<Place | null>(null);
  useEscapeLayer(onClose, isShown);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!isShown || card === null) {
      setPlace(null);
      return;
    }
    const anchorRect = anchor.getBoundingClientRect();
    const edge = boundary === null ? anchorRect.right : boundary.getBoundingClientRect().right;
    const height = card.getBoundingClientRect().height;
    const maxTop = Math.max(EDGE, window.innerHeight - height - EDGE);
    const right = edge + GAP;
    const isPastEdge = right + CARD_WIDTH > window.innerWidth - EDGE;
    setPlace({
      left: isPastEdge ? Math.max(EDGE, anchorRect.left - GAP - CARD_WIDTH) : right,
      top: Math.min(Math.max(EDGE, anchorRect.top - GAP), maxTop),
    });
  }, [anchor, boundary, isShown, session?.id]);

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
        top: place?.top ?? 0,
        left: place?.left ?? 0,
        visibility: place === null ? 'hidden' : 'visible',
      }}
      className={cn(
        FLOATING_SURFACE,
        'z-popover p-3 text-label',
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
