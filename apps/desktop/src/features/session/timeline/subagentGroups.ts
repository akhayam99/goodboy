import type { Tone } from '@goodboy/ui';
import type { RowPhase, RowState } from '../../workTreeModel/rowState';
import { groupSummaryParts, type GroupSummary } from './groupSummary';

export const SUBAGENT_GROUP_MIN_MEMBERS = 3;

export const subagentGroupEntryId = ({ parentId }: { readonly parentId: string }): string =>
  `subagents:${parentId}`;

export const subagentGroupTitle = ({ total }: { readonly total: number }): string =>
  `${total} subagents`;

type SubagentBucket =
  'asking' | 'waiting' | 'done' | 'running' | 'queued' | 'skipped' | 'closed' | 'failed';

const BUCKET_ORDER: ReadonlyArray<SubagentBucket> = [
  'asking',
  'waiting',
  'done',
  'running',
  'queued',
  'skipped',
  'closed',
  'failed',
];

const BUCKET_NOUN: Record<SubagentBucket, string> = {
  asking: 'need you',
  waiting: 'waiting',
  done: 'done',
  running: 'running',
  queued: 'queued',
  skipped: 'skipped',
  closed: 'closed',
  failed: 'failed',
};

const BUCKET_TONE: Record<SubagentBucket, Tone> = {
  asking: 'warning',
  waiting: 'warning',
  done: 'success',
  running: 'info',
  queued: 'neutral',
  skipped: 'neutral',
  closed: 'neutral',
  failed: 'danger',
};

const PHASE_BUCKET: Record<RowPhase, SubagentBucket> = {
  queued: 'queued',
  running: 'running',
  waiting: 'waiting',
  failed: 'failed',
  done: 'done',
  closed: 'closed',
  skipped: 'skipped',
};

export type SubagentFact = {
  readonly state: RowState;
  readonly isAsking: boolean;
};

export type SubagentGroupSummary = GroupSummary<SubagentBucket>;

const bucketOf = ({ fact }: { readonly fact: SubagentFact }): SubagentBucket => {
  if (fact.state.phase === 'failed') {
    return 'failed';
  }
  if (fact.isAsking || (fact.state.ask != null && fact.state.ask.kind !== 'continue')) {
    return 'asking';
  }
  return PHASE_BUCKET[fact.state.phase];
};

export const isSubagentAttention = ({ fact }: { readonly fact: SubagentFact }): boolean => {
  const bucket = bucketOf({ fact });
  return bucket === 'asking' || bucket === 'failed';
};

export const subagentGroupSummary = ({
  facts,
}: {
  readonly facts: ReadonlyArray<SubagentFact>;
}): SubagentGroupSummary => {
  const counts = new Map<SubagentBucket, number>();
  for (const fact of facts) {
    const bucket = bucketOf({ fact });
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const parts = groupSummaryParts({
    counts,
    order: BUCKET_ORDER,
    nounOf: ({ state }) => BUCKET_NOUN[state],
    toneOf: ({ state }) => BUCKET_TONE[state],
    failure: 'failed',
  });
  return {
    total: facts.length,
    parts,
    attentionCount: (counts.get('asking') ?? 0) + (counts.get('failed') ?? 0),
    failedCount: counts.get('failed') ?? 0,
  };
};

export const subagentGroupRowState = ({
  summary,
}: {
  readonly summary: SubagentGroupSummary;
}): RowState => {
  if (summary.attentionCount > 0) {
    return { phase: 'waiting', reason: null, ask: { kind: 'groupChild' } };
  }
  if (summary.parts.some((part) => part.state === 'running')) {
    return { phase: 'running', reason: null, ask: null };
  }
  if (summary.parts.some((part) => part.state === 'queued')) {
    return { phase: 'queued', reason: null, ask: null };
  }
  return { phase: 'done', reason: null, ask: null };
};
