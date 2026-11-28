import { blockShareOf } from './blockShareOf';
import type { WeekGridBlock } from './types';

export type BlockLane = Readonly<{
  lane: number;
  laneCount: number;
}>;

type Params = {
  readonly blocks: ReadonlyArray<WeekGridBlock>;
  readonly spanMinutes: number;
};

type Placed = Readonly<{
  key: string;
  lane: number;
}>;

export const blockLanesOf = ({ blocks, spanMinutes }: Params): ReadonlyMap<string, BlockLane> => {
  const lanes = new Map<string, BlockLane>();
  let cluster: Array<Placed> = [];
  let laneEnds: Array<number> = [];
  const closeCluster = (): void => {
    for (const placed of cluster) {
      lanes.set(placed.key, { lane: placed.lane, laneCount: laneEnds.length });
    }
    cluster = [];
    laneEnds = [];
  };
  const sorted = [...blocks].sort((first, second) => first.startMinute - second.startMinute);
  for (const block of sorted) {
    if (laneEnds.every((end) => end <= block.startMinute)) {
      closeCluster();
    }
    const free = laneEnds.findIndex((end) => end <= block.startMinute);
    const lane = free === -1 ? laneEnds.length : free;
    laneEnds[lane] = block.startMinute + (blockShareOf({ block, spanMinutes }) / 100) * spanMinutes;
    cluster.push({ key: block.key, lane });
  }
  closeCluster();
  return lanes;
};
