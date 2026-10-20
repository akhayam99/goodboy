export type FloatingSide = 'top' | 'bottom' | 'left' | 'right';

export type FloatingCoords = {
  readonly top: number;
  readonly left: number;
  readonly side: FloatingSide;
};

type Params = {
  readonly anchor: DOMRect;
  readonly tip: DOMRect;
  readonly side: FloatingSide;
  readonly gap: number;
  readonly edge: number;
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

export const placeFloating = ({ anchor, tip, side, gap, edge }: Params): FloatingCoords => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const place = (s: FloatingSide): Point => {
    switch (s) {
      case 'top':
        return {
          top: anchor.top - tip.height - gap,
          left: anchor.left + anchor.width / 2 - tip.width / 2,
        };
      case 'bottom':
        return {
          top: anchor.bottom + gap,
          left: anchor.left + anchor.width / 2 - tip.width / 2,
        };
      case 'left':
        return {
          top: anchor.top + anchor.height / 2 - tip.height / 2,
          left: anchor.left - tip.width - gap,
        };
      case 'right':
        return {
          top: anchor.top + anchor.height / 2 - tip.height / 2,
          left: anchor.right + gap,
        };
    }
  };

  const fits = (s: FloatingSide, p: Point): boolean => {
    if (s === 'top') {
      return p.top >= 0;
    }
    if (s === 'bottom') {
      return p.top + tip.height <= vh;
    }
    if (s === 'left') {
      return p.left >= 0;
    }
    return p.left + tip.width <= vw;
  };

  let chosen = side;
  let pos = place(side);
  if (!fits(side, pos)) {
    const flipped = flipSide({ side });
    const flippedPos = place(flipped);
    if (fits(flipped, flippedPos)) {
      chosen = flipped;
      pos = flippedPos;
    }
  }

  const left = Math.max(edge, Math.min(pos.left, vw - tip.width - edge));
  const top = Math.max(edge, Math.min(pos.top, vh - tip.height - edge));
  return { top, left, side: chosen };
};
