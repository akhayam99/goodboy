export type TrailSegmentState = 'full' | 'icon' | 'folded';

type Params = {
  readonly fullWidths: ReadonlyArray<number>;
  readonly iconWidths: ReadonlyArray<number>;
  readonly pinned?: ReadonlyArray<boolean>;
  readonly separatorWidth: number;
  readonly ellipsisWidth: number;
  readonly leadWidth: number;
  readonly available: number | null;
};

const DEPTH_FOR_ANCHOR_ICON = 4;
const DEPTH_FOR_ANCESTOR_ICONS = 5;

export const compactTrail = ({
  fullWidths,
  iconWidths,
  pinned = [],
  separatorWidth,
  ellipsisWidth,
  leadWidth,
  available,
}: Params): ReadonlyArray<TrailSegmentState> => {
  const count = fullWidths.length;
  const states: TrailSegmentState[] = fullWidths.map(() => 'full');
  const lastAncestor = count - 3;
  const canShrink = (index: number) => pinned[index] !== true;

  if (count >= DEPTH_FOR_ANCHOR_ICON && canShrink(0)) {
    states[0] = 'icon';
  }
  if (count >= DEPTH_FOR_ANCESTOR_ICONS) {
    for (let index = 0; index <= lastAncestor; index += 1) {
      if (canShrink(index)) {
        states[index] = 'icon';
      }
    }
  }
  if (available == null) {
    return states;
  }

  const total = () => {
    const visible = states.filter((state) => state !== 'folded').length;
    const hasFold = states.includes('folded');
    const segments = states.reduce((sum, state, index) => {
      if (state === 'full') {
        return sum + (fullWidths[index] ?? 0);
      }
      if (state === 'icon') {
        return sum + (iconWidths[index] ?? 0);
      }
      return sum;
    }, 0);
    const separators = Math.max(0, visible - 1 + (hasFold ? 1 : 0)) * separatorWidth;
    return leadWidth + segments + separators + (hasFold ? ellipsisWidth : 0);
  };

  for (let index = 0; index <= lastAncestor; index += 1) {
    if (total() <= available) {
      return states;
    }
    if (states[index] === 'full' && canShrink(index)) {
      states[index] = 'icon';
    }
  }
  for (let index = 1; index <= lastAncestor; index += 1) {
    if (total() <= available) {
      return states;
    }
    if (canShrink(index)) {
      states[index] = 'folded';
    }
  }
  return states;
};
