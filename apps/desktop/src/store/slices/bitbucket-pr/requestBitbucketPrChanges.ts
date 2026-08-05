import { bitbucketRequestChanges } from '../../../features/integrations/bitbucket/client';
import { runBitbucketPrWrite } from './runBitbucketPrWrite';
import type { BitbucketPrWriteParams, GetFn, SetFn } from './types';

export const requestBitbucketPrChanges = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, repo, pullRequestId }: BitbucketPrWriteParams) => {
    await runBitbucketPrWrite({
      set,
      get,
      sessionId,
      pullRequestId,
      write: async () => {
        await bitbucketRequestChanges({ ...repo, pullRequestId });
      },
    });
  };
};
