import type { Agent, IsoDateTime } from '@goodboy/types';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
};

export const newestFinishedAtOf = ({ agents }: Params): IsoDateTime | null => {
  let newest: IsoDateTime | null = null;
  for (const agent of agents) {
    const finishedAt = agent.lastFinishedAt;
    if (finishedAt != null && (newest === null || finishedAt > newest)) {
      newest = finishedAt;
    }
  }
  return newest;
};
