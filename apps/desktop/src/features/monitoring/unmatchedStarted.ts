import type { PortRow } from '@goodboy/core';
import type { StartedRow } from './startedByGoodboy';

type Params = {
  readonly started: ReadonlyArray<StartedRow>;
  readonly rows: ReadonlyArray<PortRow>;
};

export const unmatchedStarted = ({ started, rows }: Params): ReadonlyArray<StartedRow> => {
  const claimed = new Set<string>();
  for (const row of rows) {
    if (
      row.owner?.kind === 'script' ||
      row.owner?.kind === 'terminal' ||
      row.owner?.kind === 'agent'
    ) {
      claimed.add(row.owner.spawnId);
    }
  }
  return started.filter((item) => !claimed.has(item.spawnId));
};
