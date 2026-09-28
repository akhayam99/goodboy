export const HISTORY_GRAPH = {
  trunkX: 26,
  laneX: 74,
  gutter: 100,
  nodeOffset: 27,
  afterTrunkX: 14,
  afterLaneX: 40,
  afterWidth: 60,
} as const;

type LaneParams = {
  readonly trunkX: number;
  readonly laneX: number;
  readonly forkY: number;
  readonly lowY: number;
  readonly topY: number;
};

export const lanePath = ({ trunkX, laneX, forkY, lowY, topY }: LaneParams): string => {
  const bend = Math.min(30, (forkY - lowY) * 0.6);
  return [
    `M ${trunkX} ${forkY}`,
    `C ${trunkX} ${forkY - bend * 0.7}, ${laneX} ${forkY - bend * 0.3}, ${laneX} ${forkY - bend}`,
    `L ${laneX} ${lowY}`,
    `L ${laneX} ${topY}`,
  ].join(' ');
};
