import type { Agent, AgentId, MeasuredTurnSpan } from '@goodboy/types';
import { workTime, type WorkTime } from '../../workTreeModel/workTime';
import { familyActiveTime, type WorkTimeSource } from '../../workTreeModel/workTimeSource';

export type GroupRoute = {
  readonly provider: string;
  readonly model: string | null;
};

export type GroupTotals = {
  readonly costUsd: number;
  readonly time: WorkTime | null;
  readonly routes: ReadonlyArray<GroupRoute>;
};

const NO_LIVE_STARTS: ReadonlyMap<string, number> = new Map();

export const settledTimeSource = ({
  spans,
  agents,
}: {
  readonly spans: ReadonlyArray<MeasuredTurnSpan>;
  readonly agents: ReadonlyArray<Agent>;
}): WorkTimeSource => {
  const childrenOf = new Map<string, Array<AgentId>>();
  for (const agent of agents) {
    if (agent.parentAgentId == null) {
      continue;
    }
    childrenOf.set(agent.parentAgentId, [...(childrenOf.get(agent.parentAgentId) ?? []), agent.id]);
  }
  return { nowMs: 0, spans, history: null, liveStartMs: NO_LIVE_STARTS, childrenOf };
};

const familyIds = ({
  roots,
  source,
}: {
  readonly roots: ReadonlyArray<AgentId>;
  readonly source: WorkTimeSource;
}): ReadonlyArray<AgentId> => {
  const seen = new Set<AgentId>();
  const pending = [...roots];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (seen.has(next)) {
      continue;
    }
    seen.add(next);
    pending.push(...(source.childrenOf.get(next) ?? []));
  }
  return [...seen];
};

const routeKey = ({ route }: { readonly route: GroupRoute }): string =>
  `${route.provider}/${route.model ?? ''}`;

const groupRoutes = ({
  family,
  source,
  agentById,
}: {
  readonly family: ReadonlyArray<AgentId>;
  readonly source: WorkTimeSource;
  readonly agentById: ReadonlyMap<string, Agent>;
}): ReadonlyArray<GroupRoute> => {
  const members = new Set<string>(family);
  const routes = new Map<string, GroupRoute>();
  const spanned = new Set<string>();
  for (const span of source.spans) {
    if (!members.has(span.agentId)) {
      continue;
    }
    spanned.add(span.agentId);
    const route = { provider: span.provider, model: span.model };
    routes.set(routeKey({ route }), route);
  }
  for (const id of family) {
    const agent = agentById.get(id);
    if (spanned.has(id) || agent?.providerOverride == null) {
      continue;
    }
    const route = { provider: agent.providerOverride, model: agent.modelOverride ?? null };
    routes.set(routeKey({ route }), route);
  }
  return [...routes.values()];
};

type Params = {
  readonly roots: ReadonlyArray<AgentId>;
  readonly costUsd: number;
  readonly isSettled: boolean;
  readonly source: WorkTimeSource;
  readonly agentById: ReadonlyMap<string, Agent>;
};

export const groupTotals = ({
  roots,
  costUsd,
  isSettled,
  source,
  agentById,
}: Params): GroupTotals => {
  const family = familyIds({ roots, source });
  const active = familyActiveTime({ agentIds: roots, source });
  return {
    costUsd,
    time: isSettled
      ? workTime({
          phase: 'done',
          activeMs: active.activeMs,
          hasStarted: active.hasStarted,
          estimate: null,
          unknownBasis: null,
        })
      : null,
    routes: groupRoutes({ family, source, agentById }),
  };
};

export const rootsCost = ({
  roots,
  spendByAgentId,
}: {
  readonly roots: ReadonlyArray<AgentId>;
  readonly spendByAgentId: ReadonlyMap<string, number>;
}): number => roots.reduce((total, id) => total + (spendByAgentId.get(id) ?? 0), 0);
