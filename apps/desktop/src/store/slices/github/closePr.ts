import type { SessionId } from '@goodboy/types';
import { prLifecycleFailureTitle } from '../../../features/review/prLifecycle';
import { prWriteContext } from './prWriteContext';
import { prEventPayload } from './prEventPayload';
import { runPortWrite } from './runPortWrite';
import { withPrWriteClaim } from './withPrWriteClaim';
import type { GetFn, SetFn } from './types';

export const closePr = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, prNumber?: number) => {
    const { num, session, repo, port } = prWriteContext({
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
        await runPortWrite({
          get,
          sessionId,
          workspaceId: session.workspaceId,
          title: `Couldn't close #${num}`,
          run: () => port.close(),
        });
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
