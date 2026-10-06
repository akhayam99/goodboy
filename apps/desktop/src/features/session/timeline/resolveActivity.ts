import type { MountId } from '@goodboy/types';
import {
  resolveLabelOfState,
  resolveTallyOf,
  resolveTallyParts,
} from '../../resolve/commentProjection';
import { fixRunLabel } from '../../resolve/fixRun';
import type { ReviewCommentState } from '../../resolve/reviewCommentState';
import type { RowState, RowStateReason } from '../../workTreeModel/rowState';

type ResolveThreadFact = {
  readonly threadId: string;
  readonly state: ReviewCommentState;
  readonly path: string | null;
  readonly line: number | null;
};

export type ResolveActivityFacts = {
  readonly state: ReviewCommentState;
  readonly word: string;
  readonly threads?: ReadonlyArray<ResolveThreadFact>;
  readonly prNumber?: number | null;
  readonly mountId?: MountId | null;
  readonly runTitle?: string;
};

const ATTENTION_STATES: ReadonlySet<ReviewCommentState> = new Set([
  'needs',
  'ready',
  'edited',
  'outdated',
  'failed',
]);

const isResolveAttention = ({ state }: { readonly state: ReviewCommentState }): boolean =>
  ATTENTION_STATES.has(state);

export const resolverRowState = ({ facts }: { readonly facts: ResolveActivityFacts }): RowState => {
  const reason: RowStateReason = {
    kind: 'review',
    state: facts.state,
    word: facts.word,
    ...(facts.runTitle !== undefined && { runTitle: facts.runTitle }),
  };
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
  readonly path?: string | null;
  readonly line?: number | null;
};

export type ResolveAttemptLike = {
  readonly agentId: string;
  readonly batchId: string | null;
  readonly launchId?: string | null;
  readonly retryOfLaunchId?: string | null;
  readonly provider?: string;
  readonly mountTarget?: { readonly mountId: MountId } | null;
  readonly prNumber: number | null;
  readonly threadIds: ReadonlyArray<string>;
  readonly phase: 'queued' | 'running' | 'waiting' | 'finished' | 'failed' | 'cancelled';
  readonly createdAt: number;
};

const ATTEMPT_FALLBACK: Record<ResolveAttemptLike['phase'], ReviewCommentState> = {
  queued: 'drafting',
  running: 'drafting',
  waiting: 'needs',
  finished: 'ready',
  failed: 'failed',
  cancelled: 'failed',
};

const wordOfReviews = ({
  reviews,
  picked,
}: {
  readonly reviews: ReadonlyArray<ResolveReviewState>;
  readonly picked: ResolveReviewState;
}): string => {
  if (reviews.length < 2) {
    return picked.word;
  }
  const parts = resolveTallyParts({
    tally: resolveTallyOf({ states: reviews.map((review) => review.state) }),
  });
  return parts.length === 0 ? picked.word : parts.join(' · ');
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
    const state = ATTEMPT_FALLBACK[attempt.phase];
    return { state, word: resolveLabelOfState({ state }) };
  }
  return {
    state: picked.state,
    word: wordOfReviews({ reviews, picked }),
    threads: reviews.map((review) => ({
      threadId: review.threadId,
      state: review.state,
      path: review.path ?? null,
      line: review.line ?? null,
    })),
    prNumber: attempt.prNumber,
    mountId: attempt.mountTarget?.mountId ?? null,
    runTitle: fixRunLabel({ total: reviews.length, prNumber: attempt.prNumber }),
  };
};

const latestAttemptByAgentId = ({
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
  const threadIdsByAgentId = new Map<string, Set<string>>();
  for (const attempt of attempts) {
    const known = threadIdsByAgentId.get(attempt.agentId) ?? new Set<string>();
    for (const threadId of attempt.threadIds) {
      known.add(threadId);
    }
    threadIdsByAgentId.set(attempt.agentId, known);
  }
  const facts = new Map<string, ResolveActivityFacts>();
  for (const [agentId, attempt] of latestAttemptByAgentId({ attempts })) {
    const threadIds = [...(threadIdsByAgentId.get(agentId) ?? attempt.threadIds)];
    facts.set(agentId, factsOfAttempt({ attempt: { ...attempt, threadIds }, reviewByThreadId }));
  }
  return facts;
};
