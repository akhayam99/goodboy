import type { SessionId } from '@goodboy/types';
import { prLifecycleFailureTitle } from '../../../features/review/prLifecycle';
import { refreshActiveRequest } from '../review-source/refreshActiveRequest';
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
      failureTitle: ({ prNumber: target, nouns }) =>
        prLifecycleFailureTitle({ action: 'close', prNumber: target, nouns }),
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
          title: prLifecycleFailureTitle({ action: 'close', prNumber: num, nouns: port.nouns }),
          run: () => port.close(),
        });
        await refreshActiveRequest({ get, sessionId });
        await get().recordSessionEventOnce({
          sessionId,
          kind: 'pr_closed',
          payload: prEventPayload({ number: num, pr: get().sessionGithub[sessionId]?.pr ?? null }),
        });
      },
    });
  };
};
