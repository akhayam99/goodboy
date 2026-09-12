import type { MountId, SessionId } from '@goodboy/types';
import { gitPush } from '../../../features/github/github';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import type { GetFn } from './types';

type PushResult = { ok: true } | { ok: false; error: string };

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly expectedWorktreePath?: string;
};

export const pushSessionBranch = async ({
  get,
  sessionId,
  mountId,
  expectedWorktreePath,
}: Params): Promise<PushResult> => {
  const session = get().sessions.find((s) => s.id === sessionId);
  if (!session) {
    return { ok: false, error: 'session not found' };
  }
  const repo = getSessionRepo({ get, sessionId, mountId });
  if (repo == null) {
    return { ok: false, error: 'no worktree resolved for this mount to push from' };
  }
  if (expectedWorktreePath !== undefined && repo.worktreePath !== expectedWorktreePath) {
    return { ok: false, error: 'this mount moved to another worktree, so nothing was pushed' };
  }
  const branch = repo.branch.length > 0 ? repo.branch : null;
  const push = await gitPush(repo.worktreePath, branch, session.workspaceId, repo.projectId);
  if (push.exitCode !== 0) {
    return { ok: false, error: push.stderr.trim() || `git push exited with ${push.exitCode}` };
  }
  return { ok: true };
};
