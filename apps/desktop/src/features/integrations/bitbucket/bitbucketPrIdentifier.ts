import type { BitbucketPullRequest, BitbucketRepo } from './client';

type Params = {
  readonly repo: Pick<BitbucketRepo, 'workspaceSlug' | 'repoSlug'>;
  readonly pullRequest: Pick<BitbucketPullRequest, 'id'>;
};

export const bitbucketPrIdentifier = ({ repo, pullRequest }: Params): string =>
  `${repo.workspaceSlug}/${repo.repoSlug}#${pullRequest.id}`;
