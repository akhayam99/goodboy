import { isAgentStatusSettled } from '@goodboy/core/workflows';
import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { pluralize } from '../../shared/utils/pluralize';

export type RunStepCount = Readonly<{
  done: number;
  total: number | null;
}>;

type Params = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
};

export const runStepCountOf = ({ run, workflow, agents }: Params): RunStepCount => ({
  done: agents.filter(
    (agent) => agent.parentAgentId == null && isAgentStatusSettled({ status: agent.status }),
  ).length,
  total: run.executionMode === 'dynamic' ? null : workflow.steps.length,
});

export const runStepCountWordOf = ({ done, total }: RunStepCount): string =>
  total === null ? `${pluralize(done, 'step')} done` : `${done} of ${pluralize(total, 'step')}`;
