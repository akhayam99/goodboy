import type { SessionId } from '@goodboy/types';
import { prLifecycleFailureTitle } from '../../../features/review/prLifecycle';
import { refreshActiveRequest } from '../review-source/refreshActiveRequest';
import { prWriteContext } from './prWriteContext';
import { runPortWrite } from './runPortWrite';
import { withPrWriteClaim } from './withPrWriteClaim';
import { noFailureSurface, type PrWriteOptions } from './prWriteOptions';
import type { GetFn, SetFn } from './types';

export const reopenPr = (_set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    prNumber?: number,
    { mountId, hasFailureSurface = noFailureSurface }: PrWriteOptions = {},
  ) => {
    const { num, session, repo, port } = prWriteContext({
      get,
      sessionId,
      prNumber,
      ...(mountId === undefined ? {} : { mountId }),
      failureTitle: ({ prNumber: target, nouns }) =>
        prLifecycleFailureTitle({ action: 'reopen', prNumber: target, nouns }),
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
          hasFailureSurface,
          title: prLifecycleFailureTitle({ action: 'reopen', prNumber: num, nouns: port.nouns }),
          run: () => port.reopen(),
        });
        await refreshActiveRequest({
          get,
          sessionId,
          ...(mountId === undefined ? {} : { mountId }),
        });
      },
    });
  };
};
