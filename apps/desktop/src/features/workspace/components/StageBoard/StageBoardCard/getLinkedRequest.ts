import type { PullRequestState, PullRequestStateKind } from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../../integrations/gitlab/client';
import { gitlabMrStateKind } from '../../../../integrations/gitlab/gitlabMrStateKind';

type Params = {
  readonly pullRequest: PullRequestState | null;
  readonly mergeRequest: GitlabMergeRequest | null;
};

export type LinkedRequest = {
  readonly state: PullRequestStateKind | 'none';
  readonly number?: number;
  readonly title?: string;
};

export const getLinkedRequest = ({ pullRequest, mergeRequest }: Params): LinkedRequest => {
  if (pullRequest != null) {
    return {
      state: pullRequest.state,
      number: pullRequest.number,
    };
  }

  if (mergeRequest != null) {
    const state = gitlabMrStateKind({ mr: mergeRequest });
    return {
      state,
      number: mergeRequest.iid,
      title: `Merge request !${mergeRequest.iid} · ${state}`,
    };
  }

  return { state: 'none' };
};
