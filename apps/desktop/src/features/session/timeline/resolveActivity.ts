import type { ReviewCommentState } from '../../resolve/reviewCommentState';
import type { RowState, RowStateReason } from '../../workTreeModel/rowState';

export type ResolveActivityFacts = {
  readonly state: ReviewCommentState;
  readonly word: string;
};

const READY_WORD = 'Ready for you';

const ATTENTION_STATES: ReadonlySet<ReviewCommentState> = new Set([
  'needs',
  'ready',
  'edited',
  'outdated',
  'failed',
]);

export const isResolveAttention = ({ state }: { readonly state: ReviewCommentState }): boolean =>
  ATTENTION_STATES.has(state);

export const resolveActivityWord = ({
  state,
  reviewWord,
}: {
  readonly state: ReviewCommentState;
  readonly reviewWord: string;
}): string => (state === 'ready' || state === 'edited' ? READY_WORD : reviewWord);

export const resolverRowState = ({ facts }: { readonly facts: ResolveActivityFacts }): RowState => {
  const reason: RowStateReason = { kind: 'review', state: facts.state, word: facts.word };
  switch (facts.state) {
    case 'new':
      return { phase: 'queued', reason, ask: null };
    case 'drafting':
      return { phase: 'running', reason, ask: null };
    case 'needs':
    case 'ready':
    case 'edited':
    case 'outdated':
      return { phase: 'waiting', reason, ask: { kind: 'reviewComment' } };
    case 'failed':
      return { phase: 'failed', reason, ask: { kind: 'reviewComment' } };
    case 'skipped':
      return { phase: 'skipped', reason, ask: null };
    case 'accepted':
    case 'replied':
    case 'pushed':
    case 'resolved':
      return { phase: 'done', reason, ask: null };
    default: {
      const exhaustive: never = facts.state;
      return exhaustive;
    }
  }
};

export type ResolveReviewState = {
  readonly threadId: string;
  readonly state: ReviewCommentState;
  readonly word: string;
};

export type ResolveAttemptLike = {
  readonly agentId: string;
  readonly batchId: string | null;
  readonly launchId?: string | null;
  readonly retryOfLaunchId?: string | null;
  readonly provider?: string;
  readonly mountTarget?: { readonly mountId: string } | null;
  readonly prNumber: number | null;
  readonly threadIds: ReadonlyArray<string>;
  readonly phase: 'queued' | 'running' | 'waiting' | 'finished' | 'failed' | 'cancelled';
  readonly createdAt: number;
};

const ATTEMPT_FALLBACK: Record<ResolveAttemptLike['phase'], ReviewCommentState> = {
  queued: 'new',
  running: 'drafting',
  waiting: 'drafting',
  finished: 'ready',
  failed: 'failed',
  cancelled: 'skipped',
};

const FALLBACK_WORD: Record<ResolveAttemptLike['phase'], string> = {
  queued: 'Not started',
  running: 'Drafting',
  waiting: 'Drafting',
  finished: READY_WORD,
  failed: 'Draft failed',
  cancelled: 'Skipped',
};

const factsOfAttempt = ({
  attempt,
  reviewByThreadId,
}: {
  readonly attempt: ResolveAttemptLike;
  readonly reviewByThreadId: ReadonlyMap<string, ResolveReviewState>;
}): ResolveActivityFacts => {
  const reviews = attempt.threadIds.flatMap((threadId) => {
    const review = reviewByThreadId.get(threadId);
    return review === undefined ? [] : [review];
  });
  const picked =
    reviews.find((review) => isResolveAttention({ state: review.state })) ?? reviews[0];
  if (picked === undefined) {
    return { state: ATTEMPT_FALLBACK[attempt.phase], word: FALLBACK_WORD[attempt.phase] };
  }
  return {
    state: picked.state,
    word: resolveActivityWord({ state: picked.state, reviewWord: picked.word }),
  };
};

export const latestAttemptByAgentId = ({
  attempts,
}: {
  readonly attempts: ReadonlyArray<ResolveAttemptLike>;
}): ReadonlyMap<string, ResolveAttemptLike> => {
  const latest = new Map<string, ResolveAttemptLike>();
  for (const attempt of attempts) {
    const known = latest.get(attempt.agentId);
    if (known === undefined || attempt.createdAt >= known.createdAt) {
      latest.set(attempt.agentId, attempt);
    }
  }
  return latest;
};

export const resolveFactsByAgentId = ({
  attempts,
  reviews,
}: {
  readonly attempts: ReadonlyArray<ResolveAttemptLike>;
  readonly reviews: ReadonlyArray<ResolveReviewState>;
}): ReadonlyMap<string, ResolveActivityFacts> => {
  const reviewByThreadId = new Map(reviews.map((review) => [review.threadId, review]));
  const facts = new Map<string, ResolveActivityFacts>();
  for (const [agentId, attempt] of latestAttemptByAgentId({ attempts })) {
    facts.set(agentId, factsOfAttempt({ attempt, reviewByThreadId }));
  }
  return facts;
};
