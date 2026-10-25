import { refreshSessionReviewThreads } from './refreshSessionReviewThreads';
import type { GetFn, RefreshReviewSourceParams, SetFn } from './types';

type Params = RefreshReviewSourceParams & {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const refreshReviewSource = async ({
  set,
  get,
  sessionId,
  force = false,
  silent = false,
}: Params): Promise<void> => {
  await Promise.all([
    get().refreshSessionPrDetail(sessionId, { force, silent }),
    refreshSessionReviewThreads({
      set,
      get,
      sessionId,
      hosts: ['gitlab', 'bitbucket'],
      isForced: force,
      isQuiet: silent,
    }),
  ]);
};
