const MIN_SHIFT_PX = 0.5;

type Params = {
  readonly savedOffset: number | null;
  readonly currentOffset: number;
  readonly isHeld: boolean;
};

export const anchorShift = ({ savedOffset, currentOffset, isHeld }: Params): number => {
  if (isHeld || savedOffset === null) {
    return 0;
  }
  const shift = currentOffset - savedOffset;
  if (Math.abs(shift) < MIN_SHIFT_PX) {
    return 0;
  }
  return shift;
};
