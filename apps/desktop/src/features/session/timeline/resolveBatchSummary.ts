import { REVIEW_COMMENT_TONE, type ReviewCommentState } from '../../resolve/reviewCommentState';
import type { RowState } from '../../workTreeModel/rowState';
import { groupSummaryParts, type GroupSummary } from './groupSummary';
import {
  isResolveAttention,
  latestAttemptByAgentId,
  type ResolveActivityFacts,
  type ResolveAttemptLike,
} from './resolveActivity';

export type ResolveBatchRef = {
  readonly batchId: string;
  readonly prNumber: number | null;
};

type Bucket = Exclude<ReviewCommentState, 'edited'>;

const BUCKET_ORDER: ReadonlyArray<Bucket> = [
  'ready',
  'needs',
  'outdated',
  'drafting',
  'new',
  'accepted',
  'replied',
  'pushed',
  'resolved',
  'skipped',
  'failed',
];

const BUCKET_NOUN: Record<Bucket, string> = {
  ready: 'ready for you',
  needs: 'need you',
  outdated: 'changed',
  drafting: 'drafting',
  new: 'not started',
  accepted: 'accepted',
  replied: 'reply only',
  pushed: 'pushed',
  resolved: 'resolved',
  skipped: 'skipped',
  failed: 'failed',
};

export type ResolveBatchSummary = GroupSummary<ReviewCommentState>;

const bucketOf = ({ state }: { readonly state: ReviewCommentState }): Bucket =>
  state === 'edited' ? 'ready' : state;

export const resolveBatchSummary = ({
  facts,
}: {
  readonly facts: ReadonlyArray<ResolveActivityFacts>;
}): ResolveBatchSummary => {
  const counts = new Map<Bucket, number>();
  for (const fact of facts) {
    const bucket = bucketOf({ state: fact.state });
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const parts = groupSummaryParts<Bucket>({
    counts,
    order: BUCKET_ORDER,
    nounOf: ({ state }) => BUCKET_NOUN[state],
    toneOf: ({ state }) => REVIEW_COMMENT_TONE[state],
    failure: 'failed',
  });
  return {
    total: facts.length,
    parts,
    attentionCount: facts.filter((fact) => isResolveAttention({ state: fact.state })).length,
    failedCount: counts.get('failed') ?? 0,
  };
};

export const resolveBatchRowState = ({
  summary,
}: {
  readonly summary: ResolveBatchSummary;
}): RowState => {
  if (summary.attentionCount > 0) {
    return { phase: 'waiting', reason: null, ask: { kind: 'reviewComment' } };
  }
  const isDrafting = summary.parts.some((part) => part.state === 'drafting');
  if (isDrafting) {
    return { phase: 'running', reason: null, ask: null };
  }
  return { phase: 'done', reason: null, ask: null };
};

export const resolveBatchTitle = ({
  total,
  prNumber,
}: {
  readonly total: number;
  readonly prNumber: number | null;
}): string => (prNumber === null ? `${total} resolves` : `${total} resolves on PR #${prNumber}`);

export const resolveBatchByAgentId = ({
  attempts,
}: {
  readonly attempts: ReadonlyArray<ResolveAttemptLike>;
}): ReadonlyMap<string, ResolveBatchRef> => {
  const refs = new Map<string, ResolveBatchRef>();
  for (const [agentId, attempt] of latestAttemptByAgentId({ attempts })) {
    if (attempt.batchId !== null) {
      refs.set(agentId, { batchId: attempt.batchId, prNumber: attempt.prNumber });
    }
  }
  return refs;
};
