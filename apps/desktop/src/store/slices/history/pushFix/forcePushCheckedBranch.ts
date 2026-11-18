import { refreshWorktreeStatuses } from '../../../runtime/worktreeStatuses/cache';
import type { BranchPushResult } from '../../github/branchPushResult';
import { historyTargetOf } from '../historyTargetOf';
import type { SliceDeps } from '../../../slice-types';
import type { BranchOriginCheck, HistoryMountInput } from '../types';

type Params = Pick<SliceDeps, 'get'>;

type Input = HistoryMountInput & {
  readonly check: BranchOriginCheck;
};

export const forcePushCheckedBranch = ({ get }: Params) => {
  return async ({ sessionId, mountId, check }: Input): Promise<BranchPushResult> => {
    const { worktreePath } = historyTargetOf({ get, sessionId, mountId });
    const result = await get().pushBranch({
      sessionId,
      mountId,
      mode: 'lease',
      guard: {
        kind: 'confirmed',
        confirmedOnlyOnline: check.onlyOnline.map((commit) => commit.sha),
        confirmedRemoteSha: check.remoteSha,
      },
    });
    if (result.ok) {
      await refreshWorktreeStatuses({ worktreePaths: [worktreePath] });
    }
    return result;
  };
};
