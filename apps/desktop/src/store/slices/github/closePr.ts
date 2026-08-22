import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import { prEventPayload } from './prEventPayload';
import type { GetFn, SetFn } from './types';

export const closePr = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, prNumber?: number) => {
    const num = prNumber ?? get().sessionGithub[sessionId]?.pr?.number;
    const session = get().sessions.find((s) => s.id === sessionId);
    if (num == null || !session) {
      return;
    }
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (!workspace) {
      return;
    }
    const repo = getSessionRepo({ get, sessionId });
    if (repo == null) {
      return;
    }
    const res = await tauriGhRunner.run(['pr', 'close', String(num)], {
      cwd: repo.repoRoot,
      workspaceId: session.workspaceId,
      memberWorkspaceId: repo.projectId,
    });
    if (res.exitCode !== 0) {
      const errMsg = res.stderr.trim() || `gh pr close exited with ${res.exitCode}`;
      void get().emitNotification('error', 'error', `Close of #${num} failed`, errMsg, {
        sessionId,
        workspaceId: workspace.id,
      });
      throw new Error(errMsg);
    }
    await get().refreshSessionPr(sessionId, { force: true });
    await get().recordSessionEventOnce({
      sessionId,
      kind: 'pr_closed',
      payload: prEventPayload({ number: num, pr: get().sessionGithub[sessionId]?.pr ?? null }),
    });
  };
};
