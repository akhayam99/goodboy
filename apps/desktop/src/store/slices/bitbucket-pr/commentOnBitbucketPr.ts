import { bitbucketCreatePullRequestComment } from '../../../features/integrations/bitbucket/client';
import { runBitbucketPrWrite } from './runBitbucketPrWrite';
import type { BitbucketPrCommentParams, GetFn, SetFn } from './types';

export const commentOnBitbucketPr = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, repo, pullRequestId, body }: BitbucketPrCommentParams) => {
    await runBitbucketPrWrite({
      set,
      get,
      sessionId,
      pullRequestId,
      write: async () => {
        await bitbucketCreatePullRequestComment({ ...repo, pullRequestId, body });
      },
    });
  };
};
