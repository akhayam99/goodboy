import type { CachedPullRequest, PullRequestState } from '@goodboy/types';

type ToCachedPullRequestParams = {
  readonly pr: PullRequestState | null;
};

export const toCachedPullRequest = ({
  pr,
}: ToCachedPullRequestParams): CachedPullRequest | null => {
  if (pr === null) {
    return null;
  }
  return {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: pr.state,
    updatedAt: pr.updatedAt,
  };
};
