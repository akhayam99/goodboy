import { brandId, type MountId } from '@goodboy/types';
import { ONLINE_COPY_CHANGED_MESSAGE } from '../../../features/history/onlineCopyChangedMessage';
import type { AppStore } from '../../store';
import { getSessionRepo } from '../../slices/worktrees/getSessionRepo';
import { sessionById } from '../../slices/sessions/sessionIndex';
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
    const pushed = await getState().pushBranch({
      sessionId: params.sessionId,
      mountId,
      mode: 'plain',
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
  const outcome = await getState().pushBranch({
    sessionId: params.sessionId,
    mountId,
    mode: 'lease',
    guard: {
      kind: 'expected',
      expectedRemoteSha: params.leaseSha,
      sha: params.sha,
      worktreePath: params.worktreePath,
      branch: params.branch,
    },
  });
  if (outcome.ok) {
    return { kind: 'pushed' };
  }
  return outcome.reason === 'moved'
    ? { kind: 'stale', message: ONLINE_COPY_CHANGED_MESSAGE }
    : { kind: 'failed', message: outcome.error };
};
