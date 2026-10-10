import type {
  PrCheckRun,
  PrComment,
  PrDetailRead,
  PrMergeMethod,
  PrReview,
  PullRequestHost,
  PullRequestState,
  PullRequestView,
  ResolveThread,
  SessionId,
} from '@goodboy/types';
import { openReviewThreadIds } from '../../../store/slices/resolve/openReviewThreadIds';
import type { SessionGithubState } from '../../../store/types';
import { reviewNeedsYouOfThreads } from '../../resolve/reviewTally';

type PullRequestPhase = 'none' | 'draft' | 'open' | 'queued' | 'merged' | 'closed';

type PullRequestChecksPhase = 'none' | 'pending' | 'failing' | 'green' | 'unknown';

export type PullRequestFacts = {
  readonly sessionId: SessionId;
  readonly host: PullRequestHost;
  readonly pr: PullRequestState | null;
  readonly number: number | null;
  readonly phase: PullRequestPhase;
  readonly checks: PullRequestChecksPhase;
  readonly failingChecks: ReadonlyArray<string>;
  readonly runningChecks: number;
  readonly failingLogUrl: string | null;
  readonly review: PullRequestState['reviewDecision'];
  readonly changesRequestedBy: ReadonlyArray<string>;
  readonly hasConflicts: boolean;
  readonly openComments: number;
  readonly isOwn: boolean;
  readonly writeInFlight: string | null;
  readonly isScribeWriting: boolean;
  readonly commentsNeedYou: number;
  readonly isFixRunLive: boolean;
  readonly mergeMethods: ReadonlyArray<PrMergeMethod>;
  readonly mergeMethodReasons: Readonly<Partial<Record<PrMergeMethod, string>>>;
  readonly commitCount: number | null;
};

type FixSignals = {
  readonly commentsNeedYou: number;
  readonly isFixRunLive: boolean;
};

export const fixSignalsOf = ({
  threads,
}: {
  readonly threads: ReadonlyArray<ResolveThread>;
}): FixSignals => ({
  commentsNeedYou: reviewNeedsYouOfThreads({ threads }),
  isFixRunLive: threads.some(
    (thread) => thread.originKind !== 'diff_comment' && thread.state === 'working',
  ),
});

export const ALL_MERGE_METHODS: ReadonlyArray<PrMergeMethod> = ['squash', 'merge', 'rebase'];

type Params = {
  readonly sessionId: SessionId;
  readonly host?: PullRequestHost;
  readonly pr: PullRequestState | null;
  readonly checks: ReadonlyArray<PrCheckRun> | null;
  readonly checksRead?: PrDetailRead | null;
  readonly comments: ReadonlyArray<PrComment>;
  readonly reviews: ReadonlyArray<PrReview>;
  readonly viewer: string | null;
  readonly writeInFlight: string | null;
  readonly isScribeWriting: boolean;
  readonly commentsNeedYou?: number;
  readonly isFixRunLive?: boolean;
  readonly mergeMethods?: ReadonlyArray<PrMergeMethod>;
  readonly mergeMethodReasons?: Readonly<Partial<Record<PrMergeMethod, string>>>;
  readonly commitCount?: number | null;
};

const FAILED = new Set<PrCheckRun['conclusion']>(['failure', 'timed_out']);

const phaseOf = ({ pr }: { readonly pr: PullRequestState | null }): PullRequestPhase => {
  if (pr === null) {
    return 'none';
  }
  if (pr.state === 'merged' || pr.state === 'closed' || pr.state === 'queued') {
    return pr.state;
  }
  return pr.isDraft || pr.state === 'draft' ? 'draft' : 'open';
};

const checksOf = ({
  pr,
  checks,
  checksRead,
}: {
  readonly pr: PullRequestState | null;
  readonly checks: ReadonlyArray<PrCheckRun> | null;
  readonly checksRead: PrDetailRead | null;
}): PullRequestChecksPhase => {
  if (pr?.checksUnknown === true || (checksRead !== null && checksRead !== 'ok')) {
    return 'unknown';
  }
  if (checks !== null && checks.length > 0) {
    if (checks.some((check) => FAILED.has(check.conclusion))) {
      return 'failing';
    }
    return checks.some((check) => check.conclusion === 'pending') ? 'pending' : 'green';
  }
  if (pr?.checks === 'failure') {
    return 'failing';
  }
  if (pr?.checks === 'pending') {
    return 'pending';
  }
  return pr?.checks === 'success' ? 'green' : 'none';
};

const changesRequestedByOf = ({
  reviews,
}: {
  readonly reviews: ReadonlyArray<PrReview>;
}): ReadonlyArray<string> => {
  const latest = new Map<string, PrReview>();
  for (const review of reviews) {
    if (review.state === 'commented' || review.state === 'pending') {
      continue;
    }
    const previous = latest.get(review.author);
    if (previous === undefined || (review.submittedAt ?? '') >= (previous.submittedAt ?? '')) {
      latest.set(review.author, review);
    }
  }
  return [...latest.values()]
    .filter((review) => review.state === 'changes_requested')
    .map((review) => review.author);
};

export const pullRequestFacts = ({
  sessionId,
  host = 'github',
  pr,
  checks,
  checksRead = null,
  comments,
  reviews,
  viewer,
  writeInFlight,
  isScribeWriting,
  commentsNeedYou = 0,
  isFixRunLive = false,
  mergeMethods = ALL_MERGE_METHODS,
  mergeMethodReasons = {},
  commitCount = null,
}: Params): PullRequestFacts => {
  const runs = checks ?? [];
  const failing = runs.filter((check) => FAILED.has(check.conclusion));
  const author = pr?.author ?? null;
  return {
    sessionId,
    host,
    pr,
    number: pr?.number ?? null,
    phase: phaseOf({ pr }),
    checks: checksOf({ pr, checks, checksRead }),
    failingChecks: failing.map((check) => check.name),
    runningChecks: runs.filter((check) => check.conclusion === 'pending').length,
    failingLogUrl: failing.find((check) => check.detailsUrl !== null)?.detailsUrl ?? null,
    review: pr?.reviewDecision ?? null,
    changesRequestedBy: changesRequestedByOf({ reviews }),
    hasConflicts: pr?.mergeable === false,
    openComments: openReviewThreadIds({ comments }).length,
    isOwn: author === null || viewer === null || author === viewer,
    writeInFlight,
    isScribeWriting,
    commentsNeedYou,
    isFixRunLive,
    mergeMethods,
    mergeMethodReasons,
    commitCount,
  };
};

type SessionMergeParams = {
  readonly sessionId: SessionId;
  readonly host?: PullRequestHost;
  readonly github: Pick<SessionGithubState, 'pr' | 'detail'> | null;
  readonly threads: ReadonlyArray<ResolveThread>;
  readonly mergeView?: PullRequestView | null;
};

export const sessionMergeFacts = ({
  sessionId,
  host = 'github',
  github,
  threads,
  mergeView = null,
}: SessionMergeParams): PullRequestFacts => {
  const pr = github?.pr ?? null;
  const detail =
    github?.detail != null && github.detail.prNumber === pr?.number ? github.detail : null;
  return pullRequestFacts({
    sessionId,
    host,
    pr,
    checks: detail?.checks ?? null,
    checksRead: detail?.checksRead ?? null,
    comments: detail?.comments ?? [],
    reviews: detail?.reviews ?? [],
    viewer: null,
    writeInFlight: null,
    isScribeWriting: false,
    ...fixSignalsOf({ threads }),
    ...(mergeView === null
      ? {}
      : {
          mergeMethods: mergeView.mergeMethods,
          mergeMethodReasons: mergeView.mergeMethodReasons,
          commitCount: mergeView.commits.length,
        }),
  });
};
