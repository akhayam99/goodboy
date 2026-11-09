import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FLOATING_SURFACE, FactCardFootnote, FactCardHeader, ICON_SIZE, cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { BROWSER_SESSION_ATTRIBUTE } from '../../browserSessionAttribute';
import { hostOf } from '../../hostOf';
import { ownBrowserClickWord } from '../../ownBrowserClickWord';
import type { SessionLink } from '../../sessionLinkOf';
import { tabForAddress } from '../../tabForAddress';

type Props = {
  readonly link: SessionLink;
};

type Spot = {
  readonly top: number;
  readonly left: number;
};

type PlaceParams = {
  readonly anchor: DOMRect;
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

const roomOf = ({ link }: Props): DOMRect | null => {
  const box = link.anchor.closest(`[${BROWSER_SESSION_ATTRIBUTE}]`)?.getBoundingClientRect();
  return box === undefined || box.width === 0 ? null : box;
};

export const BrowserLinkPeek = ({ link }: Props) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const tabTitle = useAppStore(
    (state) =>
      tabForAddress({ tabs: state.browserSessionTabs[link.sessionId] ?? [], url: link.url })
        ?.title ?? null,
  );
  const title = tabTitle === null || tabTitle === '' ? hostOf({ url: link.url }) : tabTitle;
  const lead =
    tabTitle === null ? 'Opens beside the session.' : 'Shows its tab beside the session.';

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (card === null) {
      return;
    }
    setSpot(
      placeCard({
        anchor: link.anchor.getBoundingClientRect(),
        card: card.getBoundingClientRect(),
        room: roomOf({ link }),
      }),
    );
  }, [link]);

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
      <span className="truncate text-code text-muted-foreground">{link.url}</span>
      <FactCardFootnote text={`${lead} ${ownBrowserClickWord()} opens your browser.`} />
    </div>,
    document.body,
  );
};
