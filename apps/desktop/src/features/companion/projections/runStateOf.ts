import type { Agent, WorkflowRun } from '@goodboy/types';
import type { RunState } from '../contract/projections';

type Params = {
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
};

export const runStateOf = ({ run, agents }: Params): RunState => {
  if (agents.some((agent) => agent.status === 'running')) {
    return 'running';
  }
  if (run.orchestrationStop?.kind === 'budget') {
    return 'paused';
  }
  if (agents.some((agent) => agent.status === 'blocked')) {
    return 'waiting';
  }
  if (run.orchestrationStop?.kind === 'failure') {
    return 'failed';
  }
  if (run.orchestrationStop !== undefined) {
    return 'stopped';
  }
  if (agents.some((agent) => agent.status === 'failed')) {
    return 'failed';
  }
  return run.orchestrationOutcome === 'done' ? 'done' : 'waiting';
};
