import { branchPushLease } from '../../../features/history/branchPushLease';
import { pushFixCommand } from '../../../features/history/pushFixCommand';
import { openSessionTerminal } from '../../../features/terminal/openSessionTerminal';
import { identityChange, identityOf } from './historyIdentity';
import { historyTargetOf } from './historyTargetOf';
import type { SliceDeps } from '../../slice-types';
import type { BranchPushInput } from './types';

type Params = Pick<SliceDeps, 'get'>;

export const prefillBranchPushTerminal = ({ get }: Params) => {
  return async ({
    sessionId,
    mountId,
    isForce,
    confirmedOnlyOnline,
    confirmedRemoteSha,
  }: BranchPushInput): Promise<void> => {
    const target = historyTargetOf({ get, sessionId, mountId });
    const remoteSha = await branchPushLease({
      isForce,
      branch: target.branch,
      worktreePath: target.worktreePath,
      workspaceId: target.workspaceId,
      projectId: target.projectId,
      confirmedOnlyOnline,
      confirmedRemoteSha,
    });
    if (identityChange({ get, sessionId, mountId, identity: identityOf({ target }) }) !== null) {
      return;
    }
    openSessionTerminal({
      state: get(),
      sessionId,
      cwd: target.worktreePath,
      prefill: pushFixCommand({ branch: target.branch, remoteSha }),
    });
  };
};
