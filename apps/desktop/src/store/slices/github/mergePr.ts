import type { PrMergeMethod, SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import { prEventPayload } from './prEventPayload';
import { withPrWriteClaim } from './withPrWriteClaim';
import type { GetFn, SetFn } from './types';

const MERGE_FLAG: Record<PrMergeMethod, string> = {
  squash: '--squash',
  merge: '--merge',
  rebase: '--rebase',
};

export const mergePr = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, prNumber?: number, method: PrMergeMethod = 'squash') => {
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
    await withPrWriteClaim({
      get,
      projectId: repo.projectId,
      prNumber: num,
      action: 'merge',
      run: async () => {
        const res = await tauriGhRunner.run(['pr', 'merge', String(num), MERGE_FLAG[method]], {
          cwd: repo.repoRoot,
          workspaceId: session.workspaceId,
          projectId: repo.projectId,
        });
        if (res.exitCode !== 0) {
          const errMsg = res.stderr.trim() || `gh pr merge exited with ${res.exitCode}`;
          void get().emitNotification('error', 'error', `Merge of #${num} failed`, errMsg, {
            sessionId,
            workspaceId: workspace.id,
          });
          throw new Error(errMsg);
        }
        await get().refreshSessionPr(sessionId, { force: true });
        await get().recordSessionEventOnce({
          sessionId,
          kind: 'pr_merged',
          payload: prEventPayload({ number: num, pr: get().sessionGithub[sessionId]?.pr ?? null }),
        });
      },
    });
  };
};
