import type { PullRequestState } from '@goodboy/types';
import type { GitlabMergeRequest } from '../integrations/gitlab/client';
import { mapMrToPullRequestState } from '../integrations/gitlab/mapMrToPullRequestState';

type Params = {
  readonly prs: ReadonlyArray<PullRequestState>;
  readonly mr: GitlabMergeRequest | null;
  readonly branch: string | null;
};

export const branchRequests = ({ prs, mr, branch }: Params): ReadonlyArray<PullRequestState> => {
  if (mr == null) {
    return prs;
  }
  if (branch !== null && mr.sourceBranch !== branch) {
    return prs;
  }
  const mapped = mapMrToPullRequestState({ mr });
  return mapped === null ? prs : [...prs, mapped];
};
