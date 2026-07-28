import type { Agent } from '@goodboy/types';

type AgentLastUpdateParams = {
  readonly agent: Agent;
};

export const agentLastUpdate = ({ agent }: AgentLastUpdateParams): string | null => {
  const stamps = [agent.startedAt, agent.completedAt, agent.lastFinishedAt, agent.doneAt].filter(
    (stamp): stamp is NonNullable<typeof stamp> => stamp != null && stamp !== '',
  );
  if (stamps.length === 0) {
    return null;
  }
  return stamps.reduce((latest, stamp) =>
    Date.parse(stamp) > Date.parse(latest) ? stamp : latest,
  );
};
