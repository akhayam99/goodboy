import type { PortRow } from '@goodboy/core';

type Params = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly watchedPorts: ReadonlySet<number>;
};

type RowParams = {
  readonly row: PortRow;
  readonly watchedPorts: ReadonlySet<number>;
};

export type SplitPortRows = {
  readonly ports: ReadonlyArray<PortRow>;
  readonly also: ReadonlyArray<PortRow>;
};

const isInPorts = ({ row, watchedPorts }: RowParams): boolean =>
  row.isWatched || row.state === 'free' || watchedPorts.has(row.port);

export const splitPortRows = ({ rows, watchedPorts }: Params): SplitPortRows => {
  const ports: PortRow[] = [];
  const also: PortRow[] = [];
  for (const row of rows) {
    if (isInPorts({ row, watchedPorts })) {
      ports.push(row);
      continue;
    }
    also.push(row);
  }
  return { ports, also };
};
