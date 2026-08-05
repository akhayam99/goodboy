import type { BitbucketPullRequest } from './client';

type Params = {
  readonly pullRequest: BitbucketPullRequest;
};

export const goalFromPullRequest = ({ pullRequest }: Params): string => {
  const reference = `Bitbucket pull request #${pullRequest.id}: ${pullRequest.title}`;
  const description = pullRequest.description.trim();
  return description === '' ? reference : `${reference}\n\n${description}`;
};
