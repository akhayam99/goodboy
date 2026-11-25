import type { Agent, WorkflowRun } from '@goodboy/types';
import { runStateFrom } from '../actions/targets';
import type { RunState } from '../contract/projections';

type Params = {
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
};

export const runStateOf = ({ run, agents }: Params): RunState =>
  runStateFrom({ run, agents: agents.filter((agent) => agent.workflowRunId === run.id) });
