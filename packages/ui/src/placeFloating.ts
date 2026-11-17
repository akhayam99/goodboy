export type FloatingSide = 'top' | 'bottom' | 'left' | 'right';

export type FloatingAlign = 'start' | 'center' | 'end';

export type FloatingGrowth = 'down' | 'up';

export type FloatingRect = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right' | 'width' | 'height'>;

export type FloatingSize = Pick<DOMRect, 'width' | 'height'>;

export type FloatingViewport = {
  readonly width: number;
  readonly height: number;
};

export type FloatingCoords = {
  readonly top: number;
  readonly left: number;
  readonly side: FloatingSide;
  readonly isFlipped: boolean;
  readonly shift: number;
  readonly maxHeight: number;
  readonly growth: FloatingGrowth;
};

type Params = {
  readonly anchor: FloatingRect;
  readonly tip: FloatingSize;
  readonly side: FloatingSide;
  readonly gap: number;
  readonly edge: number;
  readonly alignment?: FloatingAlign;
  readonly crossInset?: number;
  readonly minHeight?: number;
  readonly bottomInset?: number;
  readonly viewport?: FloatingViewport;
};

type SideParams = {
  readonly side: FloatingSide;
};

type RangeParams = {
  readonly value: number;
  readonly low: number;
  readonly high: number;
};

const OPPOSITE: Readonly<Record<FloatingSide, FloatingSide>> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

const isHorizontal = ({ side }: SideParams): boolean => side === 'left' || side === 'right';

const insideMargin = ({ value, low, high }: RangeParams): number =>
  Math.max(low, Math.min(value, Math.max(low, high)));

const windowViewport = (): FloatingViewport => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

export const placeFloating = ({
  anchor,
  tip,
  side,
  gap,
  edge,
  alignment = 'center',
  crossInset = 0,
  minHeight = 0,
  bottomInset = 0,
  viewport = windowViewport(),
}: Params): FloatingCoords => {
  const floor = Math.max(
    viewport.height - edge - bottomInset,
    Math.min(anchor.bottom, viewport.height - edge),
  );
  const room: Readonly<Record<FloatingSide, number>> = {
    top: anchor.top - gap - edge,
    bottom: floor - anchor.bottom - gap,
    left: anchor.left - gap - edge,
    right: viewport.width - edge - anchor.right - gap,
  };
  const needed = isHorizontal({ side }) ? tip.width : Math.max(tip.height, minHeight);
  const opposite = OPPOSITE[side];
  const isFlipped = room[side] < needed && room[opposite] > room[side];
  const chosen = isFlipped ? opposite : side;
  const rightLimit = viewport.width - edge - tip.width;

  if (isHorizontal({ side: chosen })) {
    const roomAboveEnd = Math.min(anchor.bottom + crossInset, floor) - edge;
    const isEndHeld = alignment === 'end' && tip.height <= roomAboveEnd;
    const column = Math.max(floor - edge, 0);
    const maxHeight = isEndHeld ? roomAboveEnd : column;
    const shown = Math.min(tip.height, maxHeight);
    const centred = anchor.top + anchor.height / 2 - shown / 2;
    const desiredTop = isEndHeld
      ? anchor.bottom + crossInset - shown
      : alignment === 'center'
        ? centred
        : anchor.top - crossInset;
    const top = insideMargin({ value: desiredTop, low: edge, high: floor - shown });
    const mainLeft = chosen === 'right' ? anchor.right + gap : anchor.left - gap - tip.width;
    return {
      top,
      left: insideMargin({ value: mainLeft, low: edge, high: rightLimit }),
      side: chosen,
      isFlipped,
      shift: top - desiredTop,
      maxHeight,
      growth: isEndHeld && top <= desiredTop ? 'up' : 'down',
    };
  }

  const maxHeight = Math.max(room[chosen], 0);
  const shown = Math.min(tip.height, maxHeight);
  const desiredLeft =
    alignment === 'end'
      ? anchor.right + crossInset - tip.width
      : alignment === 'center'
        ? anchor.left + anchor.width / 2 - tip.width / 2
        : anchor.left - crossInset;
  const left = insideMargin({ value: desiredLeft, low: edge, high: rightLimit });
  const mainTop = chosen === 'bottom' ? anchor.bottom + gap : anchor.top - gap - shown;
  return {
    top: insideMargin({ value: mainTop, low: edge, high: floor - shown }),
    left,
    side: chosen,
    isFlipped,
    shift: left - desiredLeft,
    maxHeight,
    growth: chosen === 'top' ? 'up' : 'down',
  };
};
