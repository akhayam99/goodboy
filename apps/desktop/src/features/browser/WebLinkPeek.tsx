import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SessionId } from '@goodboy/types';
import { FLOATING_SURFACE, FactCardFootnote, FactCardHeader, ICON_SIZE, cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import { useLinksOpen } from '../../shared/hooks/useLinksOpen';
import { useAppStore } from '../../store';
import { hostOf } from './hostOf';
import { tabForAddress } from './tabForAddress';
import { webLinkPeekWords } from './webLinkPeekWords';

type Rect = Pick<DOMRect, 'top' | 'left' | 'bottom' | 'right'>;

export type PeekTarget = {
  readonly url: string;
  readonly sessionId: SessionId | null;
  readonly anchorOf: () => Rect;
  readonly roomOf: () => DOMRect | null;
};

type Props = {
  readonly target: PeekTarget;
};

type Spot = {
  readonly top: number;
  readonly left: number;
};

type PlaceParams = {
  readonly anchor: Rect;
  readonly card: DOMRect;
  readonly room: DOMRect | null;
};

const GAP = 8;
const EDGE = 8;

const placeCard = ({ anchor, card, room }: PlaceParams): Spot => {
  const left = room === null ? 0 : room.left;
  const right = room === null ? window.innerWidth : room.right;
  const below = anchor.bottom + GAP;
  const top =
    below + card.height + EDGE > window.innerHeight ? anchor.top - GAP - card.height : below;
  const most = Math.max(left + EDGE, right - card.width - EDGE);
  return { top, left: Math.min(Math.max(anchor.left, left + EDGE), most) };
};

export const WebLinkPeek = ({ target }: Props) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const mode = useLinksOpen();
  const tabTitle = useAppStore((state) =>
    target.sessionId === null
      ? null
      : (tabForAddress({
          tabs: state.browserSessionTabs[target.sessionId] ?? [],
          url: target.url,
        })?.title ?? null),
  );
  const title = tabTitle === null || tabTitle === '' ? hostOf({ url: target.url }) : tabTitle;
  const words = webLinkPeekWords({
    sessionId: target.sessionId,
    mode,
    hasTab: tabTitle !== null,
  });

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (card === null) {
      return;
    }
    setSpot(
      placeCard({
        anchor: target.anchorOf(),
        card: card.getBoundingClientRect(),
        room: target.roomOf(),
      }),
    );
  }, [target]);

  return createPortal(
    <div
      ref={cardRef}
      role="tooltip"
      data-testid="browser-link-peek"
      style={{
        position: 'fixed',
        top: spot?.top ?? -9999,
        left: spot?.left ?? -9999,
        visibility: spot === null ? 'hidden' : 'visible',
      }}
      className={cn(
        FLOATING_SURFACE,
        'pointer-events-none z-tooltip flex w-80 flex-col gap-2 p-3 text-meta',
        spot !== null && 'motion-safe:animate-popover-in',
      )}
    >
      <FactCardHeader
        glyph={<CONCEPT_ICONS.browser size={ICON_SIZE.row} className="text-info" />}
        title={title}
      />
      <span className="truncate text-code text-muted-foreground">{target.url}</span>
      <FactCardFootnote text={words} />
    </div>,
    document.body,
  );
};
