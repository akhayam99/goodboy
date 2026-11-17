import { branchPushLease } from '../../../features/history/branchPushLease';
import { readBranchOrigin } from './readBranchOrigin';
import type { BranchOriginCheck, BranchPushInput, HistoryTarget } from './types';

type Params = {
  readonly input: BranchPushInput;
  readonly target: HistoryTarget;
};

export type BranchPushPlan = {
  readonly isForce: boolean;
  readonly confirmedOnlyOnline: ReadonlyArray<string> | null;
  readonly confirmedRemoteSha: string | null;
  readonly leaseSha: string | null;
  readonly kept: BranchOriginCheck | null;
};

export const branchPushPlan = async ({ input, target }: Params): Promise<BranchPushPlan> => {
  if (input.isOriginMoved === true) {
    const check = await readBranchOrigin({ target });
    if (check.onlyOnline.length > 0) {
      return {
        isForce: false,
        confirmedOnlyOnline: null,
        confirmedRemoteSha: null,
        leaseSha: null,
        kept: check,
      };
    }
    return {
      isForce: true,
      confirmedOnlyOnline: [],
      confirmedRemoteSha: check.remoteSha,
      leaseSha: check.remoteSha,
      kept: null,
    };
  }
  const leaseSha = await branchPushLease({
    isForce: input.isForce,
    branch: target.branch,
    worktreePath: target.worktreePath,
    workspaceId: target.workspaceId,
    projectId: target.projectId,
    confirmedOnlyOnline: input.confirmedOnlyOnline,
    confirmedRemoteSha: input.confirmedRemoteSha,
  });
  return {
    isForce: input.isForce,
    confirmedOnlyOnline: input.confirmedOnlyOnline,
    confirmedRemoteSha: input.confirmedRemoteSha,
    leaseSha,
    kept: null,
  };
};
