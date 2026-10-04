import { REVIEW_COMMENT_TONE, type ReviewCommentState } from '../../resolve/reviewCommentState';
import type { RowState } from '../../workTreeModel/rowState';
import { groupSummaryParts, type GroupSummary } from './groupSummary';
import {
  isResolveAttention,
  latestAttemptByAgentId,
  type ResolveActivityFacts,
  type ResolveAttemptLike,
} from './resolveActivity';

export type ResolveBatchOrigin = 'launch' | 'related';

export type ResolveBatchRef = {
  readonly batchId: string;
  readonly prNumber: number | null;
  readonly origin?: ResolveBatchOrigin;
  readonly isRetry?: boolean;
};

const RELATED_WINDOW_MS = 10 * 60 * 1000;

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

export const resolveBatchTag = ({
  origin,
  retryCount,
}: {
  readonly origin: ResolveBatchOrigin;
  readonly retryCount: number;
}): string | null => {
  if (origin === 'related') {
    return 'related';
  }
  if (retryCount === 0) {
    return null;
  }
  return retryCount === 1 ? '1 retry' : `${retryCount} retries`;
};

export const resolveBatchTitle = ({
  total,
  prNumber,
}: {
  readonly total: number;
  readonly prNumber: number | null;
}): string => {
  const agents = total === 1 ? '1 agent' : `${total} agents`;
  return prNumber === null ? `Resolve · ${agents}` : `Resolve #${prNumber} · ${agents}`;
};

export const resolveBatchByAgentId = ({
  attempts,
}: {
  readonly attempts: ReadonlyArray<ResolveAttemptLike>;
}): ReadonlyMap<string, ResolveBatchRef> => {
  const refs = new Map<string, ResolveBatchRef>();
  const legacy: Array<ResolveAttemptLike> = [];
  for (const [agentId, attempt] of latestAttemptByAgentId({ attempts })) {
    const launchKey = attempt.retryOfLaunchId ?? attempt.launchId ?? null;
    if (launchKey !== null) {
      refs.set(agentId, {
        batchId: launchKey,
        prNumber: attempt.prNumber,
        origin: 'launch',
        isRetry: attempt.retryOfLaunchId != null,
      });
      continue;
    }
    if (attempt.batchId !== null) {
      refs.set(agentId, { batchId: attempt.batchId, prNumber: attempt.prNumber, origin: 'launch' });
      continue;
    }
    legacy.push(attempt);
  }
  for (const [agentId, ref] of relatedRefs({ attempts: legacy })) {
    refs.set(agentId, ref);
  }
  return refs;
};

const relatedKeyOf = ({ attempt }: { readonly attempt: ResolveAttemptLike }): string | null => {
  const mountId = attempt.mountTarget?.mountId ?? null;
  if (attempt.prNumber === null || mountId === null || attempt.provider === undefined) {
    return null;
  }
  return `${mountId}|${attempt.provider}|${attempt.prNumber}`;
};

const relatedRefs = ({
  attempts,
}: {
  readonly attempts: ReadonlyArray<ResolveAttemptLike>;
}): ReadonlyMap<string, ResolveBatchRef> => {
  const byKey = new Map<string, Array<ResolveAttemptLike>>();
  for (const attempt of attempts) {
    const key = relatedKeyOf({ attempt });
    if (key !== null) {
      byKey.set(key, [...(byKey.get(key) ?? []), attempt]);
    }
  }
  const refs = new Map<string, ResolveBatchRef>();
  for (const candidates of byKey.values()) {
    const ordered = [...candidates].sort(
      (first, second) =>
        first.createdAt - second.createdAt || first.agentId.localeCompare(second.agentId),
    );
    let anchor: ResolveAttemptLike | null = null;
    for (const attempt of ordered) {
      if (anchor === null || attempt.createdAt - anchor.createdAt > RELATED_WINDOW_MS) {
        anchor = attempt;
      }
      refs.set(attempt.agentId, {
        batchId: `related:${anchor.agentId}`,
        prNumber: attempt.prNumber,
        origin: 'related',
      });
    }
  }
  return refs;
};
