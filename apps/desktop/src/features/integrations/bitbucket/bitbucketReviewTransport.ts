import type { BitbucketReviewTransport } from '@goodboy/core';
import {
  bitbucketGetPullRequest,
  bitbucketListPullRequestComments,
  bitbucketReplyToPullRequestComment,
  type BitbucketRepo,
} from './client';

type Params = {
  readonly repo: BitbucketRepo;
  readonly pullRequestId: number;
};

export const bitbucketReviewTransport = ({
  repo,
  pullRequestId,
}: Params): BitbucketReviewTransport => {
  const target = { ...repo, pullRequestId };
  return {
    listComments: () => bitbucketListPullRequestComments(target),
    replyToComment: async ({ parentCommentId, body }) =>
      (await bitbucketReplyToPullRequestComment({ ...target, parentCommentId, body })).id,
    readHeadSha: async () => (await bitbucketGetPullRequest(target)).sourceCommit,
  };
};
