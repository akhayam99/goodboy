import type { BitbucketPullRequestTransport } from '@goodboy/core';
import { bitbucketFailureOf } from './classifyBitbucketFailure';
import {
  bitbucketDeclinePullRequest,
  bitbucketGetPullRequest,
  bitbucketListPullRequestCommits,
  bitbucketListPullRequestStatuses,
  bitbucketMergePullRequest,
  bitbucketPullRequestDiff,
  bitbucketSearchWorkspaceMembers,
  bitbucketUpdatePullRequest,
  type BitbucketRepo,
} from './client';

type Params = {
  readonly repo: BitbucketRepo;
  readonly pullRequestId: number;
};

const guarded = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    throw bitbucketFailureOf({ error });
  }
};

export const bitbucketPullRequestTransport = ({
  repo,
  pullRequestId,
}: Params): BitbucketPullRequestTransport => {
  const target = { ...repo, pullRequestId };
  return {
    readPullRequest: () => guarded(() => bitbucketGetPullRequest(target)),
    readStatuses: () => guarded(() => bitbucketListPullRequestStatuses(target)),
    readCommits: () => guarded(() => bitbucketListPullRequestCommits(target)),
    readDiff: () => guarded(() => bitbucketPullRequestDiff(target)),
    updatePullRequest: ({ title, description, reviewerUuids }) =>
      guarded(async () => {
        await bitbucketUpdatePullRequest({
          ...target,
          ...(title === undefined ? {} : { title }),
          ...(description === undefined ? {} : { description }),
          ...(reviewerUuids === undefined ? {} : { reviewerUuids }),
        });
      }),
    merge: ({ strategy }) =>
      guarded(async () => {
        await bitbucketMergePullRequest({ ...target, strategy });
      }),
    decline: () =>
      guarded(async () => {
        await bitbucketDeclinePullRequest(target);
      }),
    searchMembers: ({ query }) =>
      guarded(() =>
        bitbucketSearchWorkspaceMembers({
          workspaceId: repo.workspaceId,
          ...(repo.projectId === undefined ? {} : { projectId: repo.projectId }),
          workspaceSlug: repo.workspaceSlug,
          email: repo.email,
          query,
        }),
      ),
  };
};
