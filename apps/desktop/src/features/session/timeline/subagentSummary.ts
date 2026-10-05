import type { Tone } from '@goodboy/ui';
import type { RowPhase, RowState } from '../../workTreeModel/rowState';
import { groupSummaryParts, type GroupSummary, type GroupSummaryPart } from './groupSummary';

export const subagentsExpandId = ({ parentId }: { readonly parentId: string }): string =>
  `subagents:${parentId}`;

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

type SummaryState = SubagentBucket | 'total' | 'answered';

export type SubagentSummary = GroupSummary<SummaryState>;

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

export const subagentsCountSummary = ({
  facts,
  answered,
}: {
  readonly facts: ReadonlyArray<SubagentFact>;
  readonly answered: number;
}): SubagentSummary => {
  const counts = new Map<SubagentBucket, number>();
  for (const fact of facts) {
    const bucket = bucketOf({ fact });
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  counts.delete('done');
  const tally = groupSummaryParts({
    counts,
    order: BUCKET_ORDER,
    nounOf: ({ state }) => BUCKET_NOUN[state],
    toneOf: ({ state }) => BUCKET_TONE[state],
    failure: 'failed',
  });
  const answeredParts: ReadonlyArray<GroupSummaryPart<SummaryState>> =
    answered === 0
      ? []
      : [
          {
            state: 'answered',
            tone: 'neutral',
            count: answered,
            noun: answered === 1 ? 'question answered' : 'questions answered',
            isFailure: false,
          },
        ];
  return {
    total: facts.length,
    parts: [
      {
        state: 'total',
        tone: 'neutral',
        count: facts.length,
        noun: facts.length === 1 ? 'subagent' : 'subagents',
        isFailure: false,
      },
      ...tally,
      ...answeredParts,
    ],
    attentionCount: 0,
    failedCount: counts.get('failed') ?? 0,
  };
};
