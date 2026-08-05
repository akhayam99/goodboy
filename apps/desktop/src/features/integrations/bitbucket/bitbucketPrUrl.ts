import type { BitbucketPullRequest, BitbucketRepo } from './client';

type Params = {
  readonly repo: Pick<BitbucketRepo, 'workspaceSlug' | 'repoSlug'>;
  readonly pullRequest: Pick<BitbucketPullRequest, 'id' | 'webUrl'>;
};

export const bitbucketPrUrl = ({ repo, pullRequest }: Params): string => {
  if (pullRequest.webUrl != null && pullRequest.webUrl !== '') {
    return pullRequest.webUrl;
  }
  return `https://bitbucket.org/${repo.workspaceSlug}/${repo.repoSlug}/pull-requests/${pullRequest.id}`;
};
