import { readOriginAhead } from '../../../../features/history/historyEngine';
import type { BranchOriginCheck, HistoryTarget } from '../types';

type Params = {
  readonly target: HistoryTarget;
};

export const readBranchOrigin = async ({ target }: Params): Promise<BranchOriginCheck> => {
  const origin = await readOriginAhead({
    worktreePath: target.worktreePath,
    branch: target.branch,
    since: null,
    isBringingIn: false,
    workspaceId: target.workspaceId,
    projectId: target.projectId,
  });
  if (typeof origin.fetchError === 'string') {
    throw new Error(origin.fetchError);
  }
  return { remoteSha: origin.remoteSha, onlyOnline: origin.onlyOnline };
};
