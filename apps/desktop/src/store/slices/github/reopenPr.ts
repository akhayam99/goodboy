import type { SessionId } from '@goodboy/types';
import { prLifecycleFailureTitle } from '../../../features/review/prLifecycle';
import { prWriteContext } from './prWriteContext';
import { runPortWrite } from './runPortWrite';
import { withPrWriteClaim } from './withPrWriteClaim';
import type { GetFn, SetFn } from './types';

export const reopenPr = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, prNumber?: number) => {
    const { num, session, repo, port } = prWriteContext({
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
        await runPortWrite({
          get,
          sessionId,
          workspaceId: session.workspaceId,
          title: `Couldn't reopen #${num}`,
          run: () => port.reopen(),
        });
        await get().refreshSessionPr(sessionId, { force: true });
      },
    });
  };
};
