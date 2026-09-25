import type { AgentId, MeasuredTurnSpan, WorkflowRunId } from '@goodboy/types';
import { unionDurationMs } from './activeTime';
import type {
  DurationSample,
  DurationSamples,
  RunDurationSample,
  SampleHistory,
} from './durationEstimate';

export type DurationHistory = SampleHistory & {
  readonly orchestratedRuns: ReadonlyArray<RunDurationSample>;
};

const EMPTY_DURATION_SAMPLES: DurationSamples = { steps: [], turns: [] };

export const EMPTY_DURATION_HISTORY: DurationHistory = {
  ...EMPTY_DURATION_SAMPLES,
  everyWorkspace: EMPTY_DURATION_SAMPLES,
  orchestratedRuns: [],
};

type SpansParams = {
  readonly spans: ReadonlyArray<MeasuredTurnSpan>;
};

const totalCost = ({ spans }: SpansParams): number | null => {
  const costs = spans.flatMap((span) => (span.costUsd === null ? [] : [span.costUsd]));
  return costs.length === 0 ? null : costs.reduce((total, cost) => total + cost, 0);
};

const runSample = ({ spans }: SpansParams): RunDurationSample => ({
  activeMs: unionDurationMs({
    intervals: spans.map((span) => ({ startMs: span.startedAtMs, endMs: span.endedAtMs })),
  }),
  costUsd: totalCost({ spans }),
  endedAtMs: Math.max(...spans.map((span) => span.endedAtMs)),
});

type GroupParams<K> = {
  readonly spans: ReadonlyArray<MeasuredTurnSpan>;
  readonly keyOf: (span: MeasuredTurnSpan) => K | null;
};

const groupSpans = <K>({ spans, keyOf }: GroupParams<K>) => {
  const groups = new Map<K, Array<MeasuredTurnSpan>>();
  for (const span of spans) {
    const key = keyOf(span);
    if (key === null) {
      continue;
    }
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [span]);
      continue;
    }
    group.push(span);
  }
  return groups;
};

type RootParams = {
  readonly agentId: AgentId;
  readonly parentOf: ReadonlyMap<AgentId, AgentId | null>;
};

const rootOf = ({ agentId, parentOf }: RootParams): AgentId => {
  const seen = new Set<AgentId>([agentId]);
  let current = agentId;
  for (;;) {
    const parent = parentOf.get(current) ?? null;
    if (parent === null || seen.has(parent)) {
      return current;
    }
    seen.add(parent);
    current = parent;
  }
};

const turnSamples = ({ spans }: SpansParams): ReadonlyArray<DurationSample> =>
  spans.flatMap((span) =>
    span.endReason === 'succeeded'
      ? [
          {
            activeMs: span.endedAtMs - span.startedAtMs,
            costUsd: span.costUsd,
            endedAtMs: span.endedAtMs,
            role: span.stepRole,
            provider: span.provider,
            model: span.model,
            effort: span.effort,
          },
        ]
      : [],
  );

const stepSamples = ({ spans }: SpansParams): ReadonlyArray<DurationSample> => {
  const parentOf = new Map<AgentId, AgentId | null>();
  for (const span of spans) {
    parentOf.set(span.agentId, span.parentAgentId);
  }
  const byRoot = groupSpans<AgentId>({
    spans,
    keyOf: (span) => rootOf({ agentId: span.agentId, parentOf }),
  });
  const steps: Array<DurationSample> = [];
  for (const [rootId, group] of byRoot) {
    const own = group
      .filter((span) => span.agentId === rootId)
      .sort((left, right) => right.endedAtMs - left.endedAtMs);
    const latest = own[0];
    if (latest === undefined || latest.agentStatus !== 'completed') {
      continue;
    }
    steps.push({
      ...runSample({ spans: group }),
      role: latest.stepRole,
      provider: latest.provider,
      model: latest.model,
      effort: latest.effort,
    });
  }
  return steps;
};

const durationSamples = ({ spans }: SpansParams): DurationSamples => ({
  steps: stepSamples({ spans }),
  turns: turnSamples({ spans }),
});

type HistoryParams = SpansParams & {
  readonly everyWorkspaceSpans: ReadonlyArray<MeasuredTurnSpan>;
};

export const buildDurationHistory = ({
  spans,
  everyWorkspaceSpans,
}: HistoryParams): DurationHistory => {
  const byRun = groupSpans<WorkflowRunId>({
    spans,
    keyOf: (span) => (span.isOrchestratedRunDone ? span.workflowRunId : null),
  });
  return {
    ...durationSamples({ spans }),
    everyWorkspace: durationSamples({ spans: everyWorkspaceSpans }),
    orchestratedRuns: [...byRun.values()].map((group) => runSample({ spans: group })),
  };
};
