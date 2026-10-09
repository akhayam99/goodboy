import { isAgentStatusSettled } from '@goodboy/core';
import type { Agent, OpenQuestion, Workflow, WorkflowRun } from '@goodboy/types';
import { workflowRunHasOpenQuestions } from '../../../features/context/openQuestionsGate';

export type RunMove =
  | Readonly<{ kind: 'activate'; agent: Agent }>
  | Readonly<{ kind: 'decide' }>
  | Readonly<{ kind: 'none' }>;

const NO_MOVE: RunMove = { kind: 'none' };

type Params = {
  readonly run: WorkflowRun;
  readonly template: Workflow | undefined;
  readonly agents: ReadonlyArray<Agent>;
  readonly openQuestions: ReadonlyArray<OpenQuestion>;
};

export const nextRunMove = ({ run, template, agents, openQuestions }: Params): RunMove => {
  if (workflowRunHasOpenQuestions({ questions: openQuestions, run })) {
    return NO_MOVE;
  }
  if (template === undefined) {
    return NO_MOVE;
  }
  const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  for (const step of sortedSteps) {
    const agent = agents.find((candidate) => candidate.stepId === step.id);
    if (agent === undefined || agent.status !== 'pending') {
      continue;
    }
    const prevSteps = sortedSteps.filter((candidate) => candidate.ordinal < step.ordinal);
    const allDone = prevSteps.every((prev) =>
      agents.some(
        (candidate) =>
          candidate.stepId === prev.id && isAgentStatusSettled({ status: candidate.status }),
      ),
    );
    if (allDone) {
      return { kind: 'activate', agent };
    }
    break;
  }
  if (
    run.executionMode === 'dynamic' &&
    agents.every((agent) => isAgentStatusSettled({ status: agent.status })) &&
    run.orchestrationOutcome == null
  ) {
    return { kind: 'decide' };
  }
  return NO_MOVE;
};
