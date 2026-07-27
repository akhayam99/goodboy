import type { Agent } from '@goodboy/types';
import type { CompletionTab } from '../AgentLane/completionTab';

type Params = {
  readonly isLens: boolean;
  readonly tab: CompletionTab;
  readonly active: ReadonlyArray<Agent>;
  readonly completed: ReadonlyArray<Agent>;
  readonly all: ReadonlyArray<Agent>;
};

export const visibleLaneAgents = ({
  isLens,
  tab,
  active,
  completed,
  all,
}: Params): ReadonlyArray<Agent> => {
  if (!isLens) {
    return all;
  }
  if (tab === 'completed') {
    return completed;
  }
  return active;
};
