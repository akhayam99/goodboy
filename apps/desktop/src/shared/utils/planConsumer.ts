import type { Agent, AgentId } from '@goodboy/types';

export type PlanConsumerIdentity = Readonly<{
  name: string;
  isDeleted: boolean;
}>;

type ResolveParams = {
  readonly agentId: AgentId;
  readonly agentName: string | null;
  readonly agents?: ReadonlyArray<Agent>;
};

export const resolvePlanConsumer = ({
  agentId,
  agentName,
  agents,
}: ResolveParams): PlanConsumerIdentity => {
  const live = agents?.find((agent) => agent.id === agentId);
  if (live != null) {
    return { name: live.name, isDeleted: false };
  }
  return { name: agentName ?? agentId.substring(0, 8), isDeleted: agents != null };
};

type LabelParams = {
  readonly name: string;
  readonly count: number;
};

export const planConsumerLabel = ({ name, count }: LabelParams): string =>
  count > 1 ? `Run by ${name} +${count - 1} more` : `Run by ${name}`;
