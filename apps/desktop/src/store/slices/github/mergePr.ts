import type { PrMergeMethod, SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/integrations/github/github';
import { prLifecycleFailureTitle } from '../../../features/review/prLifecycle';
import { mountPrEventPayload } from './mountPrEventPayload';
import { prWriteContext } from './prWriteContext';
import { withPrWriteClaim } from './withPrWriteClaim';
import type { PrWriteOptions } from './prWriteOptions';
import type { GetFn, SetFn } from './types';
import { ReportedError } from '../notifications/reportedError';

const MERGE_FLAG: Record<PrMergeMethod, string> = {
  squash: '--squash',
  merge: '--merge',
  rebase: '--rebase',
};

export const mergePr = (_set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    prNumber?: number,
    method: PrMergeMethod = 'squash',
    { mountId }: PrWriteOptions = {},
  ) => {
    const { num, session, repo } = prWriteContext({
      get,
      sessionId,
      prNumber,
      ...(mountId === undefined ? {} : { mountId }),
      failureTitle: ({ prNumber: target }) =>
        prLifecycleFailureTitle({ action: 'merge', prNumber: target }),
    });
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
          void get().emitNotification({
            kind: 'error',
            severity: 'error',
            title: `Couldn't merge #${num}`,
            body: errMsg,
            sessionId,
            workspaceId: session.workspaceId,
          });
          throw new ReportedError(errMsg);
        }
        await get().refreshSessionPr(sessionId, {
          force: true,
          ...(mountId === undefined ? {} : { mountId }),
        });
        await get().recordSessionEventOnce({
          sessionId,
          kind: 'pr_merged',
          payload: mountPrEventPayload({ get, sessionId, mountId, number: num }),
        });
      },
    });
  };
};
