export type GhTokenMode = 'absent' | 'gh-cli' | 'pat';

export interface GhTokenStatus {
  mode: GhTokenMode;
  available: boolean;
  version?: string;
  user?: string;
  scopes?: ReadonlyArray<string>;
}

export type PullRequestStateKind = 'draft' | 'open' | 'approved' | 'merged' | 'closed';

export type PullRequestChecks = 'pending' | 'success' | 'failure' | null;

export interface PullRequestState {
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
}

export interface LinkedIssue {
  number: number;
  title?: string;
  url: string;
  closes: boolean;
}

export type FileDiffStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface DiffHunkLine {
  kind: 'context' | 'add' | 'del';
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: ReadonlyArray<DiffHunkLine>;
}

export interface FileDiff {
  path: string;
  oldPath?: string;
  status: FileDiffStatus;
  additions: number;
  deletions: number;
  binary: boolean;
  hunks: ReadonlyArray<DiffHunk>;
}

export interface PullRequestDiff {
  prNumber: number;
  files: ReadonlyArray<FileDiff>;
}

export interface GithubPrCacheEntry {
  branch: string;
  repoSlug: string;
  pr: PullRequestState | null;
  fetchedAt: string;
}

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

export interface PrCheckRun {
  name: string;
  conclusion: PrCheckConclusion;
  detailsUrl: string | null;
  durationMs: number | null;
}

export interface PrComment {
  id: string;
  author: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
  url: string;
  source: 'issue' | 'review';
}

export type PrReviewState =
  | 'approved'
  | 'changes_requested'
  | 'commented'
  | 'dismissed'
  | 'pending';

export interface PrReview {
  id: string;
  author: string;
  authorAvatarUrl: string | null;
  state: PrReviewState;
  submittedAt: string | null;
  body: string;
}

export interface PrReviewRequest {
  login: string;
  avatarUrl: string | null;
  kind: 'user' | 'team';
}

export interface PrDetail {
  prNumber: number;
  comments: ReadonlyArray<PrComment>;
  reviews: ReadonlyArray<PrReview>;
  reviewRequests: ReadonlyArray<PrReviewRequest>;
  checks: ReadonlyArray<PrCheckRun>;
}
