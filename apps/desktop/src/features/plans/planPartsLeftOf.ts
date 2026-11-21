import type { Agent, AgentId, PlanWithCount } from '@goodboy/types';
import { planPartRows } from './components/PlanParts/planPartRows';

export type PlanPartsLeft = Readonly<{
  title: string;
  total: number;
  left: ReadonlyArray<string>;
  hasRun: boolean;
}>;

type Params = Readonly<{
  plan: PlanWithCount;
  agents: ReadonlyArray<Agent>;
  askingAgentIds: ReadonlySet<AgentId>;
}>;

export const planPartsLeftOf = ({ plan, agents, askingAgentIds }: Params): PlanPartsLeft => {
  const rows = planPartRows({ plan, agents, askingAgentIds });
  return {
    title: plan.title,
    total: rows.length,
    left: rows.filter((row) => row.node.state !== 'done').map((row) => row.title),
    hasRun: plan.consumptionCount > 0,
  };
};
