import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId } from '@goodboy/types';
import { delegationMountIdOf } from '../delegationMountIdOf';
import { taskTitleOf } from '../taskTitleOf';
import type { LeadTreeAgentFact } from './leadTreeItemsOf';
import type { LeadTreeDelegation } from './leadTreeOf';

type Params = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
  readonly agents: ReadonlyArray<Agent>;
  readonly spendByAgentId: ReadonlyMap<AgentId, number>;
  readonly leadAgentId: AgentId;
};

export type LeadTreeFacts = Readonly<{
  delegations: ReadonlyArray<LeadTreeDelegation>;
  agentsById: ReadonlyMap<string, LeadTreeAgentFact>;
}>;

export const leadTreeDelegationsOf = ({
  delegations,
  agents,
  spendByAgentId,
  leadAgentId,
}: Params): LeadTreeFacts => {
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const agentsById = new Map<string, LeadTreeAgentFact>();
  const facts = delegations
    .filter((delegation) => !delegation.isAdopted)
    .map((delegation): LeadTreeDelegation => {
      const agent = agentById.get(delegation.childAgentId);
      agentsById.set(delegation.childAgentId, {
        agentId: delegation.childAgentId,
        title: taskTitleOf({ request: delegation.request }) ?? agent?.name ?? '',
      });
      return {
        id: delegation.id,
        agentId: delegation.childAgentId,
        parentAgentId: agent?.parentAgentId ?? leadAgentId,
        retryOfId: delegation.retryOf,
        role: delegation.role,
        createdAt: delegation.createdAt,
        isSettled: delegation.state === 'settled',
        mountId: delegationMountIdOf({ delegation }),
        spendUsd: spendByAgentId.get(delegation.childAgentId) ?? 0,
      };
    });
  return { delegations: facts, agentsById };
};
