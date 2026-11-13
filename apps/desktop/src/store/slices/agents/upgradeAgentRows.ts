import type { Agent } from '@goodboy/types';

type Params = {
  readonly before: ReadonlyArray<Agent>;
  readonly now: ReadonlyArray<Agent>;
  readonly full: ReadonlyArray<Agent>;
};

export const upgradeAgentRows = ({ before, now, full }: Params): ReadonlyArray<Agent> => {
  if (now === before) {
    return full;
  }
  const beforeById = new Map(before.map((agent) => [agent.id, agent]));
  const fullById = new Map(full.map((agent) => [agent.id, agent]));
  return now.map((agent) => {
    const fresh = fullById.get(agent.id);
    if (fresh === undefined) {
      return agent;
    }
    if (beforeById.get(agent.id) === agent) {
      return fresh;
    }
    return { ...fresh, ...agent };
  });
};
