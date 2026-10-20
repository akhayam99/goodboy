import { brandId, type MountId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { pushWithLease } from '../../../features/history/historyEngine';
import { ONLINE_COPY_CHANGED_MESSAGE } from '../../../features/history/onlineCopyChangedMessage';
import type { AppStore } from '../../store';
import { pushSessionBranch } from '../github/pushSessionBranch';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import { sessionById } from '../sessions/sessionIndex';
import type { PushBranchOutcome, PushBranchParams } from './ports';

type PushAutoBranchParams = {
  readonly getState: () => AppStore;
  readonly params: PushBranchParams;
};

const NO_BRANCH = 'This mount has no branch Goodboy can push from.';
const NO_CHECKED_SHA = 'The checked commit is unknown, so nothing was force pushed.';

export const pushAutoBranch = async ({
  getState,
  params,
}: PushAutoBranchParams): Promise<PushBranchOutcome> => {
  const mountId = brandId<MountId>({ value: params.mountId });
  if (!params.isForce) {
    const pushed = await pushSessionBranch({
      get: getState,
      sessionId: params.sessionId,
      mountId,
      expectedWorktreePath: params.worktreePath,
      expectedBranch: params.branch,
      ...(params.sha !== null && { sha: params.sha }),
    });
    return pushed.ok ? { kind: 'pushed' } : { kind: 'failed', message: pushed.error };
  }
  const session = sessionById(getState().sessions, params.sessionId);
  const repo = getSessionRepo({ get: getState, sessionId: params.sessionId, mountId });
  if (session === undefined || repo === null || repo.worktreePath !== params.worktreePath) {
    return { kind: 'failed', message: NO_BRANCH };
  }
  if (params.sha === null) {
    return { kind: 'failed', message: NO_CHECKED_SHA };
  }
  try {
    const outcome = await pushWithLease({
      worktreePath: params.worktreePath,
      branch: params.branch,
      expectedRemoteSha: params.leaseSha,
      sourceSha: params.sha,
      workspaceId: session.workspaceId,
      projectId: repo.projectId,
    });
    if (outcome.kind === 'pushed') {
      void getState().refreshSessionPr(params.sessionId, { mountId, force: true, silent: true });
      return { kind: 'pushed' };
    }
    return outcome.kind === 'stale'
      ? { kind: 'stale', message: ONLINE_COPY_CHANGED_MESSAGE }
      : { kind: 'failed', message: outcome.message };
  } catch (error) {
    return { kind: 'failed', message: formatError(error) };
  }
};
