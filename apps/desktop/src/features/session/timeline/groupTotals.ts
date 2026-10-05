import type { Agent, AgentId, MeasuredTurnSpan } from '@goodboy/types';
import { workTime, type WorkTime } from '../../workTreeModel/workTime';
import { familyActiveTime, type WorkTimeSource } from '../../workTreeModel/workTimeSource';

export type GroupTotals = {
  readonly costUsd: number;
  readonly time: WorkTime | null;
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

type Params = {
  readonly roots: ReadonlyArray<AgentId>;
  readonly costUsd: number;
  readonly isSettled: boolean;
  readonly source: WorkTimeSource;
};

export const groupTotals = ({ roots, costUsd, isSettled, source }: Params): GroupTotals => {
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
  };
};

export const rootsCost = ({
  roots,
  spendByAgentId,
}: {
  readonly roots: ReadonlyArray<AgentId>;
  readonly spendByAgentId: ReadonlyMap<string, number>;
}): number => roots.reduce((total, id) => total + (spendByAgentId.get(id) ?? 0), 0);
