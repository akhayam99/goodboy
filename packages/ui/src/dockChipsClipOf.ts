import type { DockDropZone, DockRect } from './dockDropZonesOf';
import { dockPillRectOf } from './dockPillRectOf';

type Params = {
  readonly zones: ReadonlyArray<DockDropZone>;
};

type PairParams = {
  readonly low: DockRect;
  readonly high: DockRect;
};

const MIN_CARD_PX = 40;
const PILL_GAP_PX = 12;

const isOverlap = ({ low, high }: PairParams): boolean =>
  low.x < high.x + high.width &&
  high.x < low.x + low.width &&
  low.y < high.y + high.height &&
  high.y < low.y + low.height;

type PillPairParams = {
  readonly zone: DockDropZone;
  readonly other: DockDropZone;
};

const isPillClash = ({ zone, other }: PillPairParams): boolean => {
  const low = dockPillRectOf({ zone });
  const high = dockPillRectOf({ zone: other });
  return isOverlap({
    low: {
      x: low.x - PILL_GAP_PX,
      y: low.y - PILL_GAP_PX,
      width: low.width + PILL_GAP_PX * 2,
      height: low.height + PILL_GAP_PX * 2,
    },
    high,
  });
};

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

export const dockChipsClipOf = ({ zones }: Params): ReadonlyArray<DockDropZone> => {
  const byLayer = [...zones].sort((a, b) => b.layer - a.layer);
  const kept: Array<DockDropZone> = [];
  byLayer.forEach((zone) => {
    const card = kept.reduce<DockRect | null>(
      (current, other) => (current === null ? null : clippedOf({ low: current, high: other.card })),
      zone.card,
    );
    if (card !== null && !kept.some((other) => isPillClash({ zone, other }))) {
      kept.push({ ...zone, card });
    }
  });
  return zones.flatMap((zone) => kept.filter((candidate) => candidate.id === zone.id));
};
