import type { LiveWorkRow } from '../live-state/readLiveWork';
import { workOf, type Work } from '../live-state/workOf';

type Params = {
  readonly rows: ReadonlyArray<LiveWorkRow>;
  readonly mountNames: ReadonlyMap<string, string>;
};

type NewerParams = {
  readonly newest: Work | null;
  readonly work: Work;
};

const NO_TITLES: ReadonlyMap<string, string> = new Map();

const newerOf = ({ newest, work }: NewerParams): Work => {
  if (newest === null) {
    return work;
  }
  return (work.startedAt ?? 0) > (newest.startedAt ?? 0) ? work : newest;
};

export const fleetPhraseOf = ({ rows, mountNames }: Params): string | null =>
  workOf({ rows, mountNames, sessionTitles: NO_TITLES }).reduce<Work | null>(
    (newest, work) => newerOf({ newest, work }),
    null,
  )?.phrase ?? null;
