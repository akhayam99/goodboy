export type BitbucketStatusState = 'SUCCESSFUL' | 'FAILED' | 'INPROGRESS' | 'STOPPED';

export type BitbucketPullRequestStateName = 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';

export type BitbucketMergeStrategy = 'merge_commit' | 'squash' | 'rebase_merge';

export type BitbucketPortUser = Readonly<{
  uuid: string;
  nickname: string;
  displayName: string;
  avatarUrl: string | null;
}>;

export type BitbucketPortParticipant = Readonly<{
  user: BitbucketPortUser | null;
  role: string;
  approved: boolean;
  state: string | null;
}>;

export type BitbucketPortPullRequest = Readonly<{
  id: number;
  title: string;
  description: string;
  state: BitbucketPullRequestStateName;
  createdOn: string;
  updatedOn: string;
  sourceBranch: string;
  sourceCommit: string | null;
  destinationBranch: string;
  author: BitbucketPortUser | null;
  participants: ReadonlyArray<BitbucketPortParticipant>;
  webUrl: string | null;
}>;

export type BitbucketPortStatus = Readonly<{
  key: string;
  name: string;
  state: BitbucketStatusState;
  url: string | null;
  createdOn: string;
  updatedOn: string;
}>;

export type BitbucketPortCommit = Readonly<{
  hash: string;
  message: string;
  date: string;
  author: string | null;
}>;
