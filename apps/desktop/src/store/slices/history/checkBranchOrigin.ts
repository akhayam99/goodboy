import { rememberOnlyOnline } from '../../runtime/worktreeStatuses/onlyOnline';
import { identityChange, identityOf } from './historyIdentity';
import { historyTargetOf } from './historyTargetOf';
import { readBranchOrigin } from './readBranchOrigin';
import type { SliceDeps } from '../../slice-types';
import type { BranchOriginCheck, HistoryMountInput } from './types';

type Params = Pick<SliceDeps, 'get'>;

const checkByMount = new Map<string, number>();

export const checkBranchOrigin = ({ get }: Params) => {
  return async ({ sessionId, mountId }: HistoryMountInput): Promise<BranchOriginCheck | null> => {
    const request = (checkByMount.get(mountId) ?? 0) + 1;
    checkByMount.set(mountId, request);
    const target = historyTargetOf({ get, sessionId, mountId });
    const identity = identityOf({ target });
    const check = await readBranchOrigin({ target });
    if (checkByMount.get(mountId) !== request) {
      return null;
    }
    if (identityChange({ get, sessionId, mountId, identity }) !== null) {
      return null;
    }
    rememberOnlyOnline({
      mountId,
      branch: target.branch,
      knownRemoteSha: check.remoteSha,
      commits: check.onlyOnline,
    });
    return check;
  };
};
