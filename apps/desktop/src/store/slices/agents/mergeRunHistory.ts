import type { Agent, AgentId, AgentTurnSpanRoute, ProviderRunId } from '@goodboy/types';

type RunHistory = Readonly<Record<AgentId, ReadonlyArray<ProviderRunId>>>;

type Params = {
  readonly history: RunHistory;
  readonly eventRunIds: ReadonlyMap<AgentId, ReadonlyArray<ProviderRunId>>;
  readonly routes: ReadonlyArray<AgentTurnSpanRoute>;
  readonly agents?: ReadonlyArray<Agent>;
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
    const fromEvents = eventRunIds.get(agentId) ?? [];
    const isInEvents = new Set(fromEvents);
    const onlyInSpans = (spanRunIds.get(agentId) ?? []).filter((runId) => !isInEvents.has(runId));
    const current = currentRunIds.get(agentId);
    const saved = new Set([
      ...onlyInSpans,
      ...fromEvents,
      ...(current === undefined ? [] : [current]),
    ]);
    const held = history[agentId] ?? [];
    next[agentId] = [...saved, ...held.filter((runId) => !saved.has(runId))];
  }
  return next;
};
