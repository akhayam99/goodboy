import { isPullRequestPortError } from '@goodboy/core';
import type { PrMergeMethod, SessionId } from '@goodboy/types';
import { prLifecycleFailureTitle } from '../../../features/review/prLifecycle';
import { refreshActiveRequest } from '../review-source/refreshActiveRequest';
import { mountPrEventPayload } from './mountPrEventPayload';
import { prWriteContext } from './prWriteContext';
import { reviewedHeadShaOf } from './reviewedHeadShaOf';
import { runPortWrite } from './runPortWrite';
import { withPrWriteClaim } from './withPrWriteClaim';
import type { PrWriteOptions } from './prWriteOptions';
import type { GetFn, SetFn } from './types';

type MergePrOptions = PrWriteOptions & {
  readonly expectedHeadSha?: string | null;
};

export const mergePr = (_set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    prNumber?: number,
    method: PrMergeMethod = 'squash',
    { mountId, expectedHeadSha }: MergePrOptions = {},
  ) => {
    const { num, session, repo, port } = prWriteContext({
      get,
      sessionId,
      prNumber,
      ...(mountId === undefined ? {} : { mountId }),
      failureTitle: ({ prNumber: target, nouns }) =>
        prLifecycleFailureTitle({ action: 'merge', prNumber: target, nouns }),
    });
    const reviewedHeadSha =
      expectedHeadSha !== undefined
        ? expectedHeadSha
        : reviewedHeadShaOf({
            state: get(),
            sessionId,
            prNumber: num,
            ...(mountId === undefined ? {} : { mountId }),
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
          title: prLifecycleFailureTitle({ action: 'merge', prNumber: num, nouns: port.nouns }),
          run: async () => {
            try {
              await port.merge({ method, expectedHeadSha: reviewedHeadSha });
            } catch (error) {
              if (isPullRequestPortError(error) && error.kind === 'stale_head') {
                await refreshActiveRequest({
                  get,
                  sessionId,
                  ...(mountId === undefined ? {} : { mountId }),
                });
              }
              throw error;
            }
          },
        });
        await refreshActiveRequest({
          get,
          sessionId,
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
