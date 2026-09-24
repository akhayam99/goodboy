import { composeGoal } from '../shared/composeGoal';
import type { BitbucketPullRequest } from './client';

type Params = {
  readonly pullRequest: BitbucketPullRequest;
};

export const goalFromPullRequest = ({ pullRequest }: Params): string =>
  composeGoal({
    heading: `Bitbucket pull request #${pullRequest.id}: ${pullRequest.title}`,
    body: pullRequest.description.trim(),
    source: {
      noun: 'pull request',
      reference: `#${pullRequest.id}`,
      url: pullRequest.webUrl ?? null,
    },
  });
