import type { MountDiffStat } from '../../store';

type Params = {
  readonly stats: ReadonlyMap<string, MountDiffStat>;
};

export const sumMountDiffStats = ({ stats }: Params): MountDiffStat => {
  let additions = 0;
  let deletions = 0;
  for (const stat of stats.values()) {
    additions += stat.additions;
    deletions += stat.deletions;
  }
  return { additions, deletions };
};
