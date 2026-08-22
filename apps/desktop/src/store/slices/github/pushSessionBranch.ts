import type { SessionId } from '@goodboy/types';
import { gitPush } from '../../../features/github/github';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import type { GetFn } from './types';

type PushResult = { ok: true } | { ok: false; error: string };

export const pushSessionBranch = async (get: GetFn, sessionId: SessionId): Promise<PushResult> => {
  const session = get().sessions.find((s) => s.id === sessionId);
  if (!session) {
    return { ok: false, error: 'session not found' };
  }
  const repo = getSessionRepo({ get, sessionId });
  if (repo == null) {
    return { ok: false, error: 'no worktree resolved for this session to push from' };
  }
  const branch = repo.branch.length > 0 ? repo.branch : null;
  const push = await gitPush(repo.worktreePath, branch, session.workspaceId, repo.projectId);
  if (push.exitCode !== 0) {
    return { ok: false, error: push.stderr.trim() || `git push exited with ${push.exitCode}` };
  }
  return { ok: true };
};
