import { keepOriginCommand } from '../../../features/history/keepOriginCommand';
import { pushFixCommand } from '../../../features/history/pushFixCommand';
import { openSessionTerminal } from '../../../features/terminal/openSessionTerminal';
import { branchPushPlan } from './branchPushPlan';
import { identityChange, identityOf } from './historyIdentity';
import { historyTargetOf } from './historyTargetOf';
import type { SliceDeps } from '../../slice-types';
import type { BranchPushInput } from './types';

type Params = Pick<SliceDeps, 'get'>;

export const prefillBranchPushTerminal = ({ get }: Params) => {
  return async (input: BranchPushInput): Promise<void> => {
    const { sessionId, mountId } = input;
    const target = historyTargetOf({ get, sessionId, mountId });
    const plan = await branchPushPlan({ input, target });
    if (identityChange({ get, sessionId, mountId, identity: identityOf({ target }) }) !== null) {
      return;
    }
    openSessionTerminal({
      state: get(),
      sessionId,
      cwd: target.worktreePath,
      prefill:
        plan.kept === null
          ? pushFixCommand({ branch: target.branch, remoteSha: plan.leaseSha })
          : keepOriginCommand({ branch: target.branch, remoteSha: plan.kept.remoteSha }),
    });
  };
};
