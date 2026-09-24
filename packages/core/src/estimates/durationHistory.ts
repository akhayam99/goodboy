import type { AgentId, MeasuredTurnSpan, WorkflowRunId } from '@goodboy/types';
import { unionDurationMs } from './activeTime';
import type { DurationSample, RunDurationSample } from './durationEstimate';

export type DurationHistory = {
  readonly steps: ReadonlyArray<DurationSample>;
  readonly orchestratedRuns: ReadonlyArray<RunDurationSample>;
};

export const EMPTY_DURATION_HISTORY: DurationHistory = { steps: [], orchestratedRuns: [] };

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

export const buildDurationHistory = ({ spans }: SpansParams): DurationHistory => {
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
  const byRun = groupSpans<WorkflowRunId>({
    spans,
    keyOf: (span) => (span.isOrchestratedRunDone ? span.workflowRunId : null),
  });
  const orchestratedRuns = [...byRun.values()].map((group) => runSample({ spans: group }));
  return { steps, orchestratedRuns };
};
