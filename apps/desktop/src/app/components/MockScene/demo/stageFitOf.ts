export type StageSize = {
  readonly minWidth: number;
  readonly minHeight: number;
  readonly maxScale: number;
};

export type StageBox = {
  readonly width: number;
  readonly height: number;
};

export type StageFit = {
  readonly scale: number;
  readonly width: number;
  readonly height: number;
};

export const DEFAULT_STAGE_SIZE: StageSize = { minWidth: 1100, minHeight: 700, maxScale: 1 };

type Params = {
  readonly box: StageBox;
  readonly size: StageSize;
};

export const stageFitOf = ({ box, size }: Params): StageFit => {
  const scale = Math.min(size.maxScale, box.width / size.minWidth, box.height / size.minHeight);
  if (!(scale > 0)) {
    return { scale: 0, width: 0, height: 0 };
  }
  return { scale, width: box.width / scale, height: box.height / scale };
};
