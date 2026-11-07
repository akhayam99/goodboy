import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { decisionEntries } from './decisionEntries';

type Params = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agent: Agent;
  readonly stepAgent: Agent | null;
  readonly runAgents: ReadonlyArray<Agent>;
};

type ClosingParams = Pick<Params, 'run' | 'workflow' | 'stepAgent' | 'runAgents'>;

const blockedClosingReasonOf = ({ run, workflow, stepAgent, runAgents }: ClosingParams): string => {
  if (run.orchestrationOutcome !== 'blocked' || stepAgent === null) {
    return '';
  }
  const last = runAgents
    .filter((candidate) => candidate.parentAgentId == null)
    .sort((left, right) => left.ordinal - right.ordinal)
    .at(-1);
  if (last === undefined || last.id !== stepAgent.id) {
    return '';
  }
  return decisionEntries({ run, steps: workflow.steps }).closing?.reason ?? '';
};

export const stepReasonOf = ({ run, workflow, agent, stepAgent, runAgents }: Params): string => {
  if (stepAgent === null || stepAgent.id !== agent.id) {
    return '';
  }
  const closing = blockedClosingReasonOf({ run, workflow, stepAgent, runAgents });
  if (closing !== '') {
    return closing;
  }
  const decision = decisionEntries({ run, steps: workflow.steps }).decisions.find(
    (entry) => entry.stepId === stepAgent.stepId,
  );
  const own = workflow.steps.find((step) => step.id === stepAgent.stepId)?.orchestratorReason;
  return (decision?.reason ?? own ?? '').trim();
};
