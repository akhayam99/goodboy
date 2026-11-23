import type { MountId } from '@goodboy/types';
import type { SettledBranches } from './archiveSuggestionOf';

type Params = {
  readonly mountId: MountId | null;
  readonly settledMountIds: ReadonlySet<string>;
  readonly settledBranches: SettledBranches;
};

export const isSettledWorkOf = ({ mountId, settledMountIds, settledBranches }: Params): boolean => {
  if (mountId !== null) {
    return settledMountIds.has(mountId);
  }
  return settledBranches.merged + settledBranches.closed > 0;
};
