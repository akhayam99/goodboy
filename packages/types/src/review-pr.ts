import type { PullRequestStateKind } from './github';
import type { ProjectId } from './ids';

export type ReviewablePrProvider = 'github' | 'gitlab';

export type ReviewablePr = {
  id: string;
  provider: ReviewablePrProvider;
  projectId?: ProjectId;
  repo: string;
  number: number;
  title: string;
  url: string;
  author: string;
  authorAvatarUrl: string | null;
  mine: boolean;
  reviewRequested: boolean;
  state: PullRequestStateKind;
  baseBranch: string;
  headBranch: string;
  isDraft: boolean;
  updatedAt: string;
};
