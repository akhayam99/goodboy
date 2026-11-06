import type { Agent, AgentId, PlanWithCount } from '@goodboy/types';
import { resolvePlanConsumer } from '../../../shared/utils/planConsumer';

export type PlanCommentsTarget = Readonly<{
  agentId: AgentId;
  name: string;
  canReceive: boolean;
}>;

type Params = Readonly<{
  plan: Pick<PlanWithCount, 'lastConsumer'>;
  agents: ReadonlyArray<Agent>;
}>;

const UNREACHABLE: ReadonlyArray<Agent['status']> = ['stopped', 'failed', 'skipped'];

export const planCommentsTargetOf = ({ plan, agents }: Params): PlanCommentsTarget | null => {
  const consumer = plan.lastConsumer ?? null;
  if (consumer === null) {
    return null;
  }
  const agent = agents.find((candidate) => candidate.id === consumer.agentId);
  const { name } = resolvePlanConsumer({
    agentId: consumer.agentId,
    agentName: consumer.name,
    agents,
  });
  return {
    agentId: consumer.agentId,
    name,
    canReceive:
      agent !== undefined && agent.deletedAt == null && !UNREACHABLE.includes(agent.status),
  };
};
