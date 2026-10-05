import type { Tone } from '@goodboy/ui';
import { RESOLVE_WORD_OF_STATE, type ResolveWord } from '../../resolve/commentProjection';
import type { RowState } from '../../workTreeModel/rowState';
import { groupSummaryParts, type GroupSummary } from './groupSummary';
import {
  isResolveAttention,
  latestAttemptByAgentId,
  type ResolveActivityFacts,
  type ResolveAttemptLike,
  type ResolveThreadFact,
} from './resolveActivity';

export type ResolveBatchOrigin = 'launch' | 'related';

export type ResolveBatchRef = {
  readonly batchId: string;
  readonly prNumber: number | null;
  readonly origin?: ResolveBatchOrigin;
  readonly isRetry?: boolean;
};

const RELATED_WINDOW_MS = 10 * 60 * 1000;

const BUCKET_ORDER: ReadonlyArray<ResolveWord> = [
  'ready',
  'needs_you',
  'working',
  'open',
  'done',
  'couldnt_fix',
];

const BUCKET_NOUN: Record<ResolveWord, string> = {
  ready: 'ready',
  needs_you: 'needs you',
  working: 'working',
  open: 'open',
  done: 'done',
  couldnt_fix: "couldn't fix",
};

const BUCKET_TONE: Record<ResolveWord, Tone> = {
  ready: 'warning',
  needs_you: 'warning',
  working: 'info',
  open: 'neutral',
  done: 'success',
  couldnt_fix: 'danger',
};

export type ResolveBatchSummary = GroupSummary<ResolveWord>;

const statesOf = ({
  facts,
}: {
  readonly facts: ReadonlyArray<ResolveActivityFacts>;
}): ReadonlyArray<ResolveThreadFact['state']> =>
  facts.flatMap((fact) =>
    fact.threads === undefined || fact.threads.length === 0
      ? [fact.state]
      : fact.threads.map((thread) => thread.state),
  );

export const resolveBatchSummary = ({
  facts,
}: {
  readonly facts: ReadonlyArray<ResolveActivityFacts>;
}): ResolveBatchSummary => {
  const states = statesOf({ facts });
  const counts = new Map<ResolveWord, number>();
  for (const state of states) {
    const word = RESOLVE_WORD_OF_STATE[state];
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const parts = groupSummaryParts<ResolveWord>({
    counts,
    order: BUCKET_ORDER,
    nounOf: ({ state }) => BUCKET_NOUN[state],
    toneOf: ({ state }) => BUCKET_TONE[state],
    failure: 'couldnt_fix',
  });
  return {
    total: states.length,
    parts,
    attentionCount: states.filter((state) => isResolveAttention({ state })).length,
    failedCount: counts.get('couldnt_fix') ?? 0,
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
  const isWorking = summary.parts.some((part) => part.state === 'working');
  if (isWorking) {
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
  const comments = total === 1 ? '1 comment' : `${total} comments`;
  return prNumber === null ? `Fix run · ${comments}` : `Fix run · #${prNumber} · ${comments}`;
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
