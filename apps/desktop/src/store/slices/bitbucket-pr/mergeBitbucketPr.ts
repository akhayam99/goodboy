import { bitbucketMergePullRequest } from '../../../features/integrations/bitbucket/client';
import { runBitbucketPrWrite } from './runBitbucketPrWrite';
import type { BitbucketPrWriteParams, GetFn, SetFn } from './types';

export const mergeBitbucketPr = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, repo, pullRequestId }: BitbucketPrWriteParams) => {
    await runBitbucketPrWrite({
      set,
      get,
      sessionId,
      pullRequestId,
      write: async () => {
        await bitbucketMergePullRequest({ ...repo, pullRequestId });
      },
    });
  };
};
