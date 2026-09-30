import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/integrations/github/github';
import { prLifecycleFailureTitle } from '../../../features/review/prLifecycle';
import { prWriteContext } from './prWriteContext';
import { withPrWriteClaim } from './withPrWriteClaim';
import type { GetFn, SetFn } from './types';
import { ReportedError } from '../notifications/reportedError';

export const reopenPr = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, prNumber?: number) => {
    const { num, session, repo } = prWriteContext({
      get,
      sessionId,
      prNumber,
      failureTitle: ({ prNumber: target }) =>
        prLifecycleFailureTitle({ action: 'reopen', prNumber: target }),
    });
    await withPrWriteClaim({
      get,
      projectId: repo.projectId,
      prNumber: num,
      action: 'reopen',
      run: async () => {
        const res = await tauriGhRunner.run(['pr', 'reopen', String(num)], {
          cwd: repo.repoRoot,
          workspaceId: session.workspaceId,
          projectId: repo.projectId,
        });
        if (res.exitCode !== 0) {
          const errMsg = res.stderr.trim() || `gh pr reopen exited with ${res.exitCode}`;
          void get().emitNotification({
            kind: 'error',
            severity: 'error',
            title: `Couldn't reopen #${num}`,
            body: errMsg,
            sessionId,
            workspaceId: session.workspaceId,
          });
          throw new ReportedError(errMsg);
        }
        await get().refreshSessionPr(sessionId, { force: true });
      },
    });
  };
};
