import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { prLifecycleFailureTitle } from '../../../features/review/prLifecycle';
import { prWriteContext } from './prWriteContext';
import { prEventPayload } from './prEventPayload';
import { withPrWriteClaim } from './withPrWriteClaim';
import type { GetFn, SetFn } from './types';
import { ReportedError } from '../notifications/reportedError';

export const closePr = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, prNumber?: number) => {
    const { num, session, repo } = prWriteContext({
      get,
      sessionId,
      prNumber,
      failureTitle: ({ prNumber: target }) =>
        prLifecycleFailureTitle({ action: 'close', prNumber: target }),
    });
    await withPrWriteClaim({
      get,
      projectId: repo.projectId,
      prNumber: num,
      action: 'close',
      run: async () => {
        const res = await tauriGhRunner.run(['pr', 'close', String(num)], {
          cwd: repo.repoRoot,
          workspaceId: session.workspaceId,
          projectId: repo.projectId,
        });
        if (res.exitCode !== 0) {
          const errMsg = res.stderr.trim() || `gh pr close exited with ${res.exitCode}`;
          void get().emitNotification({
            kind: 'error',
            severity: 'error',
            title: `Couldn't close #${num}`,
            body: errMsg,
            sessionId,
            workspaceId: session.workspaceId,
          });
          throw new ReportedError(errMsg);
        }
        await get().refreshSessionPr(sessionId, { force: true });
        await get().recordSessionEventOnce({
          sessionId,
          kind: 'pr_closed',
          payload: prEventPayload({ number: num, pr: get().sessionGithub[sessionId]?.pr ?? null }),
        });
      },
    });
  };
};
