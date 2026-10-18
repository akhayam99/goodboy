import type { SplitPortRows } from './splitPortRows';

type Params = {
  readonly split: Pick<SplitPortRows, 'pinned' | 'goodboy'>;
};

export type MonitoringSignal = {
  readonly inUse: number;
  readonly downPins: ReadonlyArray<number>;
};

export const monitoringSignal = ({ split }: Params): MonitoringSignal => ({
  inUse: new Set(
    [...split.pinned, ...split.goodboy]
      .filter((row) => row.state === 'listening')
      .map((row) => row.port),
  ).size,
  downPins: [
    ...new Set(split.pinned.filter((row) => row.state === 'free').map((row) => row.port)),
  ].sort((a, b) => a - b),
});
