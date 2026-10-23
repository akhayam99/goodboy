import type { GetFn, RebaseAllOutcome, UpdateAllInput } from './types';

export const updateAll = (get: GetFn) => {
  return ({
    sessionId,
    rebaseMountIds,
    bringInMountIds,
  }: UpdateAllInput): Promise<RebaseAllOutcome> =>
    get().rebaseAll({
      sessionId,
      mountIds: rebaseMountIds,
      bringInMountIds,
      shouldTidy: false,
      shouldHandConflicts: false,
    });
};
