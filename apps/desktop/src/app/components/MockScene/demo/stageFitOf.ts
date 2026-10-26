import { APP_SIZE } from './appSize';

export type StageBox = {
  readonly width: number;
  readonly height: number;
};

export type StageFit = {
  readonly scale: number;
  readonly width: number;
  readonly height: number;
};

type Params = {
  readonly box: StageBox;
};

export const stageFitOf = ({ box }: Params): StageFit => {
  const scale = Math.min(1, box.width / APP_SIZE.width, box.height / APP_SIZE.height);
  if (!(scale > 0)) {
    return { scale: 0, width: 0, height: 0 };
  }
  return { scale, width: box.width / scale, height: box.height / scale };
};
