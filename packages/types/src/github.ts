import type { IsoDateTime, SessionId } from './ids';

export type GhTokenMode = 'absent' | 'gh-cli' | 'pat';

export type GhTokenStatus = {
  mode: GhTokenMode;
  available: boolean;
  version?: string;
  user?: string;
  scopes?: ReadonlyArray<string>;
  scoped?: boolean;
};

export type PullRequestStateKind = 'draft' | 'open' | 'approved' | 'merged' | 'closed';

export type PullRequestChecks = 'pending' | 'success' | 'failure' | null;

export type PullRequestState = {
  number: number;
  title: string;
  url: string;
  state: PullRequestStateKind;
  mergeable: boolean | null;
  checks: PullRequestChecks;
  baseBranch: string;
  headBranch: string;
  isDraft: boolean;
  reviewDecision: 'approved' | 'changes_requested' | 'review_required' | null;
  body: string;
  updatedAt: string;
};

export type LinkedIssue = {
  number: number;
  title?: string;
  url: string;
  closes: boolean;
};

export type FileDiffStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export type DiffHunkLine = {
  kind: 'context' | 'add' | 'del';
  oldLine: number | null;
  newLine: number | null;
  text: string;
};

export type DiffHunk = {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: ReadonlyArray<DiffHunkLine>;
};

export type FileDiff = {
  path: string;
  oldPath?: string;
  status: FileDiffStatus;
  additions: number;
  deletions: number;
  binary: boolean;
  hunks: ReadonlyArray<DiffHunk>;
};

export type PullRequestDiff = {
  prNumber: number;
  files: ReadonlyArray<FileDiff>;
};

export type GithubPrCacheEntry = {
  branch: string;
  repoSlug: string;
  pr: PullRequestState | null;
  fetchedAt: string;
};

export type PrCheckConclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | 'stale'
  | 'skipped'
  | 'pending'
  | 'unknown';

export type PrCheckRun = {
  name: string;
  conclusion: PrCheckConclusion;
  detailsUrl: string | null;
  durationMs: number | null;
};

export type PrComment = {
  id: string;
  author: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
  url: string;
  source: 'issue' | 'review';
  path?: string;
  line?: number;
  resolved?: boolean;
  inReplyToId?: string;
  threadId?: string;
};

export type PrReviewState =
  | 'approved'
  | 'changes_requested'
  | 'commented'
  | 'dismissed'
  | 'pending';

export type PrReview = {
  id: string;
  author: string;
  authorAvatarUrl: string | null;
  state: PrReviewState;
  submittedAt: string | null;
  body: string;
};

export type PrReviewRequest = {
  login: string;
  avatarUrl: string | null;
  kind: 'user' | 'team';
};

export type PrDetail = {
  prNumber: number;
  comments: ReadonlyArray<PrComment>;
  reviews: ReadonlyArray<PrReview>;
  reviewRequests: ReadonlyArray<PrReviewRequest>;
  checks: ReadonlyArray<PrCheckRun>;
};

export type PendingResolution = {
  id: string;
  sessionId: SessionId;
  prNumber: number;
  threadId: string;
  commitSha: string;
  createdAt: IsoDateTime;
};
