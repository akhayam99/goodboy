import type { DockDropZone, DockRect } from './dockDropZonesOf';

type Params = {
  readonly zones: ReadonlyArray<DockDropZone>;
};

type PairParams = {
  readonly low: DockRect;
  readonly high: DockRect;
};

const MIN_CARD_PX = 40;

const isOverlap = ({ low, high }: PairParams): boolean =>
  low.x < high.x + high.width &&
  high.x < low.x + low.width &&
  low.y < high.y + high.height &&
  high.y < low.y + low.height;

const clippedOf = ({ low, high }: PairParams): DockRect | null => {
  if (!isOverlap({ low, high })) {
    return low;
  }
  const isFullHeight = high.y <= low.y && high.y + high.height >= low.y + low.height;
  if (!isFullHeight) {
    return null;
  }
  const isHighLeft = high.x + high.width / 2 < low.x + low.width / 2;
  const x = isHighLeft ? high.x + high.width : low.x;
  const right = isHighLeft ? low.x + low.width : high.x;
  const width = right - x;
  return width < MIN_CARD_PX ? null : { ...low, x, width };
};

export const dockCardsClipOf = ({ zones }: Params): ReadonlyArray<DockDropZone> => {
  const byLayer = [...zones].sort((a, b) => b.layer - a.layer);
  const kept: Array<DockDropZone> = [];
  byLayer.forEach((zone) => {
    const card = kept.reduce<DockRect | null>(
      (current, other) => (current === null ? null : clippedOf({ low: current, high: other.card })),
      zone.card,
    );
    if (card !== null) {
      kept.push({ ...zone, card });
    }
  });
  return zones.flatMap((zone) => kept.filter((candidate) => candidate.id === zone.id));
};
