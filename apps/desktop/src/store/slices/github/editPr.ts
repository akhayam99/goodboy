import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import type { GetFn, SetFn } from './types';

export type EditPrOptions = {
  title?: string;
  body?: string;
};

export const editPr = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, prNumber: number, opts: EditPrOptions) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) {
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

    const args = ['pr', 'edit', String(prNumber)];
    if (opts.title !== undefined) {
      args.push('--title', opts.title);
    }
    if (opts.body !== undefined) {
      args.push('--body', opts.body);
    }
    if (args.length === 3) {
      return;
    }

    const res = await tauriGhRunner.run(args, {
      cwd: repo.repoRoot,
      workspaceId: session.workspaceId,
      memberWorkspaceId: repo.projectId,
    });
    if (res.exitCode !== 0) {
      const errMsg = res.stderr.trim() || `gh pr edit exited with ${res.exitCode}`;
      void get().emitNotification('error', 'error', 'Edit failed', errMsg, {
        sessionId,
        workspaceId: workspace.id,
      });
      throw new Error(errMsg);
    }
    await get().refreshSessionPr(sessionId, { force: true });
  };
};
