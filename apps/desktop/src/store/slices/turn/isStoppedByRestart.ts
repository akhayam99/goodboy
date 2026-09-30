import type { Agent } from '@goodboy/types';

type Params = {
  readonly agent: Pick<Agent, 'status' | 'stoppedBy' | 'doneAt'>;
};

export const isStoppedByRestart = ({ agent }: Params): boolean =>
  agent.status === 'stopped' && agent.stoppedBy === 'app' && agent.doneAt == null;
