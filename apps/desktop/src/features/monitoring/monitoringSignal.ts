import type { SplitPortRows } from './splitPortRows';

type Params = {
  readonly split: Pick<SplitPortRows, 'pinned' | 'goodboy'>;
};

export type MonitoringSignal = {
  readonly inUse: number;
  readonly hasDownPin: boolean;
};

export const monitoringSignal = ({ split }: Params): MonitoringSignal => ({
  inUse: new Set(
    [...split.pinned, ...split.goodboy]
      .filter((row) => row.state === 'listening')
      .map((row) => row.port),
  ).size,
  hasDownPin: split.pinned.some((row) => row.state === 'free'),
});
