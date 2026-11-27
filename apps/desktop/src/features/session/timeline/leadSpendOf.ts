import type { Agent, AgentId, ProviderRunId, TelemetryRecord } from '@goodboy/types';
import { agentOwnSpendById } from './agentOwnSpendById';
import { agentSpendById } from './agentSpendById';

type Params = {
  readonly records: ReadonlyArray<TelemetryRecord>;
  readonly agents: ReadonlyArray<Agent>;
  readonly agentRunHistory: Readonly<Record<AgentId, ReadonlyArray<ProviderRunId>>>;
  readonly agentId: AgentId;
};

export type LeadSpend = Readonly<{
  ownUsd: number;
  runUsd: number;
  hasHelpers: boolean;
}>;

export const leadSpendOf = ({ records, agents, agentRunHistory, agentId }: Params): LeadSpend => ({
  ownUsd: agentOwnSpendById({ records, agents, agentRunHistory }).get(agentId) ?? 0,
  runUsd: agentSpendById({ records, agents, agentRunHistory }).get(agentId) ?? 0,
  hasHelpers: agents.some((agent) => agent.parentAgentId === agentId),
});
