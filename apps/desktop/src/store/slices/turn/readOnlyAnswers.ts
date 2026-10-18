import type { AgentId } from '@goodboy/types';

type Params = Readonly<{ agentId: AgentId }>;

const createReadOnlyAnswers = () => {
  const requested = new Set<AgentId>();
  const request = ({ agentId }: Params): void => {
    requested.add(agentId);
  };
  const take = ({ agentId }: Params): boolean => requested.delete(agentId);
  return { request, take };
};

export const readOnlyAnswers = createReadOnlyAnswers();
