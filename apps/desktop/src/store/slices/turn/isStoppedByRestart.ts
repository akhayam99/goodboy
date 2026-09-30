import { isAgentStatusSettled } from '@goodboy/core';
import type { Agent } from '@goodboy/types';

type Params = {
  readonly agent: Pick<Agent, 'id' | 'status' | 'stoppedBy' | 'doneAt'>;
  readonly runs: ReadonlyArray<Pick<Agent, 'parentAgentId' | 'deletedAt' | 'status'>>;
};

export const isStoppedByRestart = ({ agent, runs }: Params): boolean =>
  agent.status === 'stopped' &&
  agent.stoppedBy === 'app' &&
  agent.doneAt == null &&
  !runs.some(
    (run) =>
      run.parentAgentId === agent.id &&
      run.deletedAt == null &&
      !isAgentStatusSettled({ status: run.status }),
  );
