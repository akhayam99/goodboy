import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import type { GetFn, SetFn } from './types';

export function reopenPr(_set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, prNumber?: number) => {
    const num = prNumber ?? get().sessionGithub[sessionId]?.pr?.number;
    const session = get().sessions.find((s) => s.id === sessionId);
    if (num == null || !session) return;
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (!workspace) return;
    const res = await tauriGhRunner.run(['pr', 'reopen', String(num)], {
      cwd: workspace.rootPath,
      workspaceId: session.workspaceId,
    });
    if (res.exitCode !== 0) {
      const errMsg = res.stderr.trim() || `gh pr reopen exited with ${res.exitCode}`;
      void get().emitNotification('error', 'error', `Reopen of #${num} failed`, errMsg, {
        sessionId,
        workspaceId: workspace.id,
      });
      throw new Error(errMsg);
    }
    await get().refreshSessionPr(sessionId, { force: true });
  };
}
