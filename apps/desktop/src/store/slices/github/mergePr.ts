import type { PrMergeMethod, SessionId } from '@goodboy/types';
import { prLifecycleFailureTitle } from '../../../features/review/prLifecycle';
import { mountPrEventPayload } from './mountPrEventPayload';
import { prWriteContext } from './prWriteContext';
import { runPortWrite } from './runPortWrite';
import { withPrWriteClaim } from './withPrWriteClaim';
import type { PrWriteOptions } from './prWriteOptions';
import type { GetFn, SetFn } from './types';

export const mergePr = (_set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    prNumber?: number,
    method: PrMergeMethod = 'squash',
    { mountId }: PrWriteOptions = {},
  ) => {
    const { num, session, repo, port } = prWriteContext({
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
        await runPortWrite({
          get,
          sessionId,
          workspaceId: session.workspaceId,
          title: `Couldn't merge #${num}`,
          run: () => port.merge({ method }),
        });
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
