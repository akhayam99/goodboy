import type { Agent, WorkflowRun } from '@goodboy/types';

type Params = {
  readonly run: Pick<WorkflowRun, 'discardedAt' | 'triggerMode'>;
  readonly agents: ReadonlyArray<Pick<Agent, 'id'>>;
};

export const isRunQueuedManual = ({ run, agents }: Params): boolean =>
  run.discardedAt == null && run.triggerMode === 'manual' && agents.length === 0;
