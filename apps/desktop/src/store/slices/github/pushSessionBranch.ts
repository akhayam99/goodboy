import type { MountId, SessionId } from '@goodboy/types';
import { gitPush } from '../../../features/github/github';
import { refreshWorktreeStatuses } from '../../../features/session/hooks/useWorktreeStatuses/cache';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import type { GetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

type PushResult = { ok: true } | { ok: false; error: string };

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly expectedWorktreePath?: string;
  readonly sha?: string;
};

export const pushSessionBranch = async ({
  get,
  sessionId,
  mountId,
  expectedWorktreePath,
  sha,
}: Params): Promise<PushResult> => {
  const session = sessionById(get().sessions, sessionId);
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
  const push = await gitPush({
    cwd: repo.worktreePath,
    branch,
    workspaceId: session.workspaceId,
    projectId: repo.projectId,
    sha,
  });
  if (push.exitCode !== 0) {
    return { ok: false, error: push.stderr.trim() || `git push exited with ${push.exitCode}` };
  }
  await refreshWorktreeStatuses({ worktreePaths: [repo.worktreePath] }).catch(() => undefined);
  void get().refreshSessionPr(sessionId, { mountId, force: true, silent: true });
  return { ok: true };
};
