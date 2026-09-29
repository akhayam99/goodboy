const AFTER_NODE_GAP = 44;

type Params = {
  readonly keep: ReadonlyArray<string>;
  readonly rowY: ReadonlyMap<string, number>;
  readonly forkY: number;
  readonly topY: number;
  readonly gap?: number;
};

export const historyAfterLayout = ({
  keep,
  rowY,
  forkY,
  topY,
  gap = AFTER_NODE_GAP,
}: Params): ReadonlyMap<string, number> => {
  const positions = new Map<string, number>();
  let previous = forkY;
  for (const sha of keep) {
    const wanted = rowY.get(sha) ?? previous - gap;
    const y = Math.min(wanted, previous - gap);
    positions.set(sha, y);
    previous = y;
  }
  if (keep.length === 0 || previous >= topY) {
    return positions;
  }
  const step = (forkY - topY) / keep.length;
  keep.forEach((sha, index) => {
    positions.set(sha, forkY - step * (index + 1) + step * 0.35);
  });
  return positions;
};
