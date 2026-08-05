import type { PullRequestStateKind } from '@goodboy/types';
import type { GitlabMergeRequest } from './client';

type Params = {
  readonly mr: GitlabMergeRequest;
};

export const gitlabMrStateKind = ({ mr }: Params): PullRequestStateKind => {
  if (mr.state === 'merged') {
    return 'merged';
  }
  if (mr.state === 'closed' || mr.state === 'locked') {
    return 'closed';
  }
  if (mr.draft) {
    return 'draft';
  }
  return 'open';
};
