import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import type { GetFn, SetFn } from './types';

export function requestReview(_set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, prNumber: number, reviewers: ReadonlyArray<string>) => {
    const logins = reviewers.map((r) => r.trim()).filter(Boolean);
    if (logins.length === 0) return;
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (!workspace) return;

    const res = await tauriGhRunner.run(
      ['pr', 'edit', String(prNumber), '--add-reviewer', logins.join(',')],
      { cwd: workspace.rootPath, workspaceId: session.workspaceId },
    );
    if (res.exitCode !== 0) {
      const errMsg = res.stderr.trim() || `gh pr edit --add-reviewer exited with ${res.exitCode}`;
      void get().emitNotification('error', 'error', 'Request review failed', errMsg, {
        sessionId,
        workspaceId: workspace.id,
      });
      throw new Error(errMsg);
    }
    await get().refreshSessionPrDetail(sessionId, { force: true });
  };
}
