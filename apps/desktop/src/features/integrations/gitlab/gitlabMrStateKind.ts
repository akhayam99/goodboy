import { gitlabStateKindOf } from '@goodboy/core';
import type { PullRequestStateKind } from '@goodboy/types';
import type { GitlabMergeRequest } from './client';

type Params = {
  readonly mr: GitlabMergeRequest;
};

export const gitlabMrStateKind = ({ mr }: Params): PullRequestStateKind =>
  gitlabStateKindOf({ state: mr.state, draft: mr.draft });
