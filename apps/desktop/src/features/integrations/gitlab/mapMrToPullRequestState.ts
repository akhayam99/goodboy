import type { PullRequestState } from '@goodboy/types';
import type { GitlabMergeRequest } from './client';
import { gitlabMrStateKind } from './gitlabMrStateKind';

type Params = {
  readonly mr: GitlabMergeRequest | null;
};

export const mapMrToPullRequestState = ({ mr }: Params): PullRequestState | null => {
  if (mr == null) {
    return null;
  }
  return {
    number: mr.iid,
    title: mr.title,
    url: mr.webUrl,
    state: gitlabMrStateKind({ mr }),
    mergeable: null,
    checks: null,
    baseBranch: mr.targetBranch,
    headBranch: mr.sourceBranch,
    isDraft: mr.draft,
    reviewDecision: null,
    body: mr.description ?? '',
    updatedAt: mr.updatedAt,
  };
};
