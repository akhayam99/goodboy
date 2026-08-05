import { bitbucketReplyToPullRequestComment } from '../../../features/integrations/bitbucket/client';
import { runBitbucketPrWrite } from './runBitbucketPrWrite';
import type { BitbucketPrReplyParams, GetFn, SetFn } from './types';

export const replyToBitbucketPrComment = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    repo,
    pullRequestId,
    parentCommentId,
    body,
  }: BitbucketPrReplyParams) => {
    await runBitbucketPrWrite({
      set,
      get,
      sessionId,
      pullRequestId,
      write: async () => {
        await bitbucketReplyToPullRequestComment({
          ...repo,
          pullRequestId,
          parentCommentId,
          body,
        });
      },
    });
  };
};
