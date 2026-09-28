import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import { mountPrEventPayload } from './mountPrEventPayload';
import { withPrWriteClaim } from './withPrWriteClaim';
import type { PrWriteOptions } from './prWriteOptions';
import type { GetFn, SetFn } from './types';
import { ReportedError } from '../notifications/reportedError';

export const markPrReady = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, prNumber?: number, { mountId }: PrWriteOptions = {}) => {
    const num = prNumber ?? get().sessionGithub[sessionId]?.pr?.number;
    const session = get().sessions.find((s) => s.id === sessionId);
    if (num == null || !session) {
      return;
    }
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (!workspace) {
      return;
    }
    const repo = getSessionRepo({ get, sessionId, ...(mountId === undefined ? {} : { mountId }) });
    if (repo == null) {
      return;
    }
    await withPrWriteClaim({
      get,
      projectId: repo.projectId,
      prNumber: num,
      action: 'ready',
      run: async () => {
        const res = await tauriGhRunner.run(['pr', 'ready', String(num)], {
          cwd: repo.repoRoot,
          workspaceId: session.workspaceId,
          projectId: repo.projectId,
        });
        if (res.exitCode !== 0) {
          const errMsg = res.stderr.trim() || `gh pr ready exited with ${res.exitCode}`;
          void get().emitNotification({
            kind: 'error',
            severity: 'error',
            title: `Couldn't mark #${num} ready`,
            body: errMsg,
            sessionId,
            workspaceId: workspace.id,
          });
          throw new ReportedError(errMsg);
        }
        await get().refreshSessionPr(sessionId, {
          force: true,
          ...(mountId === undefined ? {} : { mountId }),
        });
        await get().recordSessionEventOnce({
          sessionId,
          kind: 'pr_ready',
          payload: mountPrEventPayload({ get, sessionId, mountId, number: num }),
        });
      },
    });
  };
};
