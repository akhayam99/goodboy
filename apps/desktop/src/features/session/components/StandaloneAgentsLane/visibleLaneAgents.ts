import type { Agent } from '@goodboy/types';

type Params = {
  readonly isLens: boolean;
  readonly showCompleted: boolean;
  readonly active: ReadonlyArray<Agent>;
  readonly completed: ReadonlyArray<Agent>;
  readonly all: ReadonlyArray<Agent>;
};

export const visibleLaneAgents = ({
  isLens,
  showCompleted,
  active,
  completed,
  all,
}: Params): ReadonlyArray<Agent> => {
  if (!isLens) {
    return all;
  }
  if (showCompleted) {
    return [...active, ...completed];
  }
  return active;
};
