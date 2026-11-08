import type { BranchGroup } from '../../../../branchGroupsOf';
import { archivedFoldKeyOf } from './branchGroupRunsOf';

type Params = {
  readonly returnRowId: string | null;
  readonly branchGroups: ReadonlyArray<BranchGroup>;
};

export const returnFoldKeyOf = ({ returnRowId, branchGroups }: Params): string | undefined => {
  if (returnRowId === null) {
    return undefined;
  }
  for (const group of branchGroups) {
    const run = group.runs.find((candidate) => `${group.key}/${candidate.id}` === returnRowId);
    if (run === undefined) {
      continue;
    }
    if (run.isArchived) {
      return archivedFoldKeyOf({ groupKey: group.key });
    }
    return run.isFinished ? group.key : undefined;
  }
  return undefined;
};
