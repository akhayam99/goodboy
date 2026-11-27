import type { Agent, AgentId, AgentTurnSpanRoute, ProviderRunId } from '@goodboy/types';

type RunHistory = Readonly<Record<AgentId, ReadonlyArray<ProviderRunId>>>;

type Params = {
  readonly history: RunHistory;
  readonly eventRunIds: ReadonlyMap<AgentId, ReadonlyArray<ProviderRunId>>;
  readonly routes: ReadonlyArray<AgentTurnSpanRoute>;
  readonly agents?: ReadonlyArray<Agent>;
};

type InterleaveParams = {
  readonly fromEvents: ReadonlyArray<ProviderRunId>;
  readonly fromSpans: ReadonlyArray<ProviderRunId>;
};

const interleaveRuns = ({ fromEvents, fromSpans }: InterleaveParams): ProviderRunId[] => {
  const ordered = [...fromEvents];
  let anchor = -1;
  for (const runId of fromSpans) {
    const found = ordered.indexOf(runId);
    if (found !== -1) {
      anchor = found;
      continue;
    }
    ordered.splice(anchor + 1, 0, runId);
    anchor += 1;
  }
  return ordered;
};

export const mergeRunHistory = ({
  history,
  eventRunIds,
  routes,
  agents = [],
}: Params): RunHistory => {
  const spanRunIds = new Map<AgentId, ProviderRunId[]>();
  for (const route of routes) {
    const bucket = spanRunIds.get(route.agentId) ?? [];
    bucket.push(route.runId);
    spanRunIds.set(route.agentId, bucket);
  }
  const currentRunIds = new Map<AgentId, ProviderRunId>(
    agents.flatMap((agent) => (agent.runId == null ? [] : [[agent.id, agent.runId] as const])),
  );
  const next: Record<AgentId, ReadonlyArray<ProviderRunId>> = { ...history };
  for (const agentId of new Set([
    ...eventRunIds.keys(),
    ...spanRunIds.keys(),
    ...currentRunIds.keys(),
  ])) {
    const current = currentRunIds.get(agentId);
    const saved = new Set([
      ...interleaveRuns({
        fromEvents: eventRunIds.get(agentId) ?? [],
        fromSpans: spanRunIds.get(agentId) ?? [],
      }),
      ...(current === undefined ? [] : [current]),
    ]);
    const held = history[agentId] ?? [];
    next[agentId] = [...saved, ...held.filter((runId) => !saved.has(runId))];
  }
  return next;
};
