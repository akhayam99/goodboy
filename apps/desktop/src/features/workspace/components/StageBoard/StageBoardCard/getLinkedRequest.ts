import type { PullRequestState, PullRequestStateKind } from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../../integrations/gitlab/client';

type Params = {
  readonly pullRequest: PullRequestState | null;
  readonly mergeRequest: GitlabMergeRequest | null;
};

type LinkedRequest = {
  readonly state: PullRequestStateKind | 'none';
  readonly number?: number;
  readonly title?: string;
};

type MergeRequestStateParams = Pick<GitlabMergeRequest, 'draft' | 'state'>;

const getMergeRequestState = ({ draft, state }: MergeRequestStateParams): PullRequestStateKind => {
  if (draft) {
    return 'draft';
  }

  switch (state) {
    case 'opened':
    case 'open':
      return 'open';
    case 'merged':
      return 'merged';
    case 'closed':
      return 'closed';
    default:
      return 'open';
  }
};

export const getLinkedRequest = ({ pullRequest, mergeRequest }: Params): LinkedRequest => {
  if (pullRequest != null) {
    return {
      state: pullRequest.state,
      number: pullRequest.number,
    };
  }

  if (mergeRequest != null) {
    const state = getMergeRequestState(mergeRequest);
    return {
      state,
      number: mergeRequest.iid,
      title: `Merge request !${mergeRequest.iid} · ${state}`,
    };
  }

  return { state: 'none' };
};
