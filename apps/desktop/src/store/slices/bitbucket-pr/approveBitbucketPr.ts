import { bitbucketApprovePullRequest } from '../../../features/integrations/bitbucket/client';
import { runBitbucketPrWrite } from './runBitbucketPrWrite';
import type { BitbucketPrWriteParams, GetFn, SetFn } from './types';

export const approveBitbucketPr = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, repo, pullRequestId }: BitbucketPrWriteParams) => {
    await runBitbucketPrWrite({
      set,
      get,
      sessionId,
      pullRequestId,
      write: async () => {
        await bitbucketApprovePullRequest({ ...repo, pullRequestId });
      },
    });
  };
};
