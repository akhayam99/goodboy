import type { PrCheckRun, PrMergeMethod, PullRequestStateKind } from './github';

export type PullRequestHost = 'github' | 'gitlab' | 'bitbucket';

export type PullRequestPerson = {
  readonly login: string;
  readonly name: string | null;
  readonly avatarUrl: string | null;
};

export type PullRequestReviewerState =
  'approved' | 'changes_requested' | 'commented' | 'pending' | 'dismissed';

export type PullRequestReviewer = {
  readonly person: PullRequestPerson;
  readonly state: PullRequestReviewerState;
};

export type PullRequestResolve = {
  readonly label: string;
  readonly url: string | null;
  readonly isClosing: boolean;
};

export type PullRequestChecksRead = 'ok' | 'denied' | 'failed' | 'unsupported';

export type PullRequestChecksView = {
  readonly read: PullRequestChecksRead;
  readonly error: string | null;
  readonly runs: ReadonlyArray<PrCheckRun>;
};

export type PullRequestFileStat = {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
};

export type PullRequestCommit = {
  readonly sha: string;
  readonly headline: string;
  readonly committedAt: string;
  readonly author: string | null;
};

export type PullRequestReviewDecision = 'approved' | 'changes_requested' | 'review_required';

export type PullRequestView = {
  readonly host: PullRequestHost;
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly state: PullRequestStateKind;
  readonly isDraft: boolean;
  readonly author: PullRequestPerson | null;
  readonly baseBranch: string;
  readonly headBranch: string;
  readonly headSha: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly mergedAt: string | null;
  readonly mergeable: boolean | null;
  readonly reviewDecision: PullRequestReviewDecision | null;
  readonly reviewers: ReadonlyArray<PullRequestReviewer>;
  readonly resolves: ReadonlyArray<PullRequestResolve>;
  readonly checks: PullRequestChecksView;
  readonly files: {
    readonly count: number;
    readonly first: ReadonlyArray<PullRequestFileStat>;
  };
  readonly commits: ReadonlyArray<PullRequestCommit>;
  readonly mergeMethods: ReadonlyArray<PrMergeMethod>;
  readonly mergeMethodReasons: Partial<Record<PrMergeMethod, string>>;
};

export type PullRequestNouns = {
  readonly long: 'pull request' | 'merge request';
  readonly short: 'PR' | 'MR';
  readonly numberPrefix: '#' | '!';
};
