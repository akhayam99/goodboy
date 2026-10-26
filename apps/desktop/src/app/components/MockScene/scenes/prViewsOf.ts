import type { BranchCommit, MountId, PullRequestState, SessionId } from '@goodboy/types';
import type { PullRequestViewEntry } from '../../../../store/slices/pull-request-view/state';

type Params = {
  readonly pr: PullRequestState;
  readonly mountId: MountId;
  readonly commits: ReadonlyArray<Pick<BranchCommit, 'sha' | 'subject' | 'author' | 'timestamp'>>;
};

const prViewEntryOf = ({ pr, mountId, commits }: Params): PullRequestViewEntry => ({
  prNumber: pr.number,
  mountId,
  view: {
    host: 'github',
    number: pr.number,
    title: pr.title,
    body: pr.body,
    url: pr.url,
    state: pr.state,
    isDraft: pr.isDraft,
    author: pr.author == null ? null : { login: pr.author, name: null, avatarUrl: null },
    baseBranch: pr.baseBranch,
    headBranch: pr.headBranch,
    headSha: pr.headSha ?? null,
    createdAt: pr.updatedAt,
    updatedAt: pr.updatedAt,
    mergedAt: null,
    mergeable: pr.mergeable,
    reviewDecision: pr.reviewDecision,
    reviewers: [],
    resolves: [],
    checks: { read: 'ok', error: null, runs: [] },
    files: { count: 0, first: [] },
    commits: commits.map((commit) => ({
      sha: commit.sha,
      headline: commit.subject,
      committedAt: new Date(commit.timestamp * 1000).toISOString(),
      author: commit.author,
    })),
    mergeMethods: [],
    mergeMethodReasons: {},
  },
  isLoading: false,
  error: null,
  fetchedAt: null,
  edits: [],
});

type SessionParams = Params & { readonly sessionId: SessionId };

export const prViewsOf = ({ sessionId, ...rest }: SessionParams) => ({
  [sessionId]: { [rest.mountId]: prViewEntryOf(rest) },
});
