import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import type { GetFn, SetFn } from './types';

export function createPrForSession(_set: SetFn, get: GetFn) {
  return async (sessionId: SessionId) => {
    const branch = get().sessionBranches[sessionId];
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!branch || !session) return;
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (!workspace) return;
    const res = await tauriGhRunner.run(['pr', 'create', '--fill', '--draft'], {
      cwd: workspace.rootPath,
    });
    if (res.exitCode !== 0) {
      const errMsg = res.stderr.trim() || `gh pr create exited with ${res.exitCode}`;
      void get().emitNotification('error', 'error', 'PR creation failed', errMsg, {
        sessionId,
        workspaceId: workspace.id,
      });
      throw new Error(errMsg);
    }
    await get().refreshSessionPr(sessionId, { force: true });
    void get().emitNotification(
      'pr-created',
      'success',
      `PR created for: ${session.goal}`,
      undefined,
      { sessionId, workspaceId: workspace.id },
    );
  };
}
