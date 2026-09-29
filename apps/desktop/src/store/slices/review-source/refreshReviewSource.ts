import { refreshGitlabReviewThreads } from './refreshGitlabReviewThreads';
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
    refreshGitlabReviewThreads({ set, get, sessionId, force, silent }),
  ]);
};
