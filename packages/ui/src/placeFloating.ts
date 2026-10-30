export type FloatingSide = 'top' | 'bottom' | 'left' | 'right';

export type FloatingCoords = {
  readonly top: number;
  readonly left: number;
  readonly side: FloatingSide;
};

export type FloatingRect = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right' | 'width' | 'height'>;

export type FloatingAlign = 'center' | 'start';

type Params = {
  readonly anchor: FloatingRect;
  readonly tip: FloatingRect;
  readonly side: FloatingSide;
  readonly gap: number;
  readonly edge: number;
  readonly alignment?: FloatingAlign;
};

type Point = { readonly top: number; readonly left: number };

type FlipParams = {
  readonly side: FloatingSide;
};

const flipSide = ({ side }: FlipParams): FloatingSide => {
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

export const placeFloating = ({
  anchor,
  tip,
  side,
  gap,
  edge,
  alignment = 'center',
}: Params): FloatingCoords => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const isStart = alignment === 'start';
  const centeredLeft = isStart ? anchor.left - gap : anchor.left + anchor.width / 2 - tip.width / 2;
  const centeredTop = isStart ? anchor.top - gap : anchor.top + anchor.height / 2 - tip.height / 2;

  const place = (s: FloatingSide): Point => {
    switch (s) {
      case 'top':
        return { top: anchor.top - tip.height - gap, left: centeredLeft };
      case 'bottom':
        return { top: anchor.bottom + gap, left: centeredLeft };
      case 'left':
        return { top: centeredTop, left: anchor.left - tip.width - gap };
      case 'right':
        return { top: centeredTop, left: anchor.right + gap };
    }
  };

  const overflowOf = (s: FloatingSide, p: Point): number => {
    if (s === 'top') {
      return Math.max(0, edge - p.top);
    }
    if (s === 'bottom') {
      return Math.max(0, p.top + tip.height - (vh - edge));
    }
    if (s === 'left') {
      return Math.max(0, edge - p.left);
    }
    return Math.max(0, p.left + tip.width - (vw - edge));
  };

  const first = place(side);
  const flipped = flipSide({ side });
  const second = place(flipped);
  const isFlipped =
    overflowOf(side, first) > 0 && overflowOf(flipped, second) < overflowOf(side, first);
  const chosen = isFlipped ? flipped : side;
  const pos = isFlipped ? second : first;

  const left = Math.max(edge, Math.min(pos.left, vw - tip.width - edge));
  const top = Math.max(edge, Math.min(pos.top, vh - tip.height - edge));
  return { top, left, side: chosen };
};
