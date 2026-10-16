import type { Agent, OpenQuestion, Workflow, WorkflowRun } from '@goodboy/types';
import { isAgentStatusHalted, isAgentStatusSettled } from '@goodboy/core';
import type { DotState } from '@goodboy/ui';
import { workflowRunOpenQuestions } from '../context/openQuestionsGate';
import { isRunPaused } from './isRunPaused';
import { isWorkflowRunClosedByUser } from './isWorkflowRunClosedByUser';
import { isRunHeldForPlan } from '../../store/slices/workflows/workflowPlanApproval';

export type RunRowFacts = {
  readonly dot: DotState;
  readonly word: string;
  readonly progress: string;
  readonly isActive: boolean;
};

type Params = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly predecessorName: string;
  readonly isOrchestrating: boolean;
  readonly questions: ReadonlyArray<OpenQuestion>;
};

type StateFacts = {
  readonly dot: DotState;
  readonly word: string;
};

type RunParams = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
};

const stepAgentsOf = ({ agents }: Pick<RunParams, 'agents'>): ReadonlyArray<Agent> =>
  agents.filter((agent) => agent.parentAgentId == null);

const isRunDone = ({ run, workflow, agents }: RunParams): boolean => {
  if (run.executionMode === 'dynamic') {
    return run.orchestrationOutcome === 'done';
  }
  const settled = stepAgentsOf({ agents }).filter((agent) =>
    isAgentStatusSettled({ status: agent.status }),
  ).length;
  return workflow.steps.length > 0 && settled >= workflow.steps.length;
};

const progressOf = ({ run, workflow, agents }: RunParams): string => {
  const steps = stepAgentsOf({ agents });
  const started = steps.filter((agent) => agent.status !== 'pending').length;
  if (started === 0) {
    return '';
  }
  if (run.executionMode === 'dynamic') {
    return `${started} ${started === 1 ? 'step' : 'steps'}`;
  }
  const total = workflow.steps.length;
  const settled = steps.filter((agent) => isAgentStatusSettled({ status: agent.status })).length;
  if (settled >= total) {
    return `${total} of ${total} steps`;
  }
  return `Step ${Math.min(settled + 1, total)} of ${total}`;
};

const stateOf = ({
  run,
  workflow,
  agents,
  predecessorName,
  isOrchestrating,
  questions,
}: Params): StateFacts => {
  if (run.discardedAt != null) {
    return { dot: 'idle', word: 'Archived' };
  }
  if (isWorkflowRunClosedByUser({ run })) {
    return { dot: 'idle', word: 'Stopped' };
  }
  if (isRunDone({ run, workflow, agents })) {
    return { dot: 'done', word: 'Done' };
  }
  const isRunning = agents.some((agent) => agent.status === 'running');
  const stop = run.orchestrationStop ?? null;
  if (isRunPaused({ run })) {
    return { dot: 'idle', word: 'Paused' };
  }
  if (isRunHeldForPlan({ run })) {
    return { dot: 'needsYou', word: 'Plan ready' };
  }
  if (stop?.kind === 'operator') {
    return isOrchestrating
      ? { dot: 'running', word: 'Stopping' }
      : { dot: 'idle', word: 'Stopped' };
  }
  if (stop?.kind === 'budget' && !isRunning) {
    return { dot: 'needsYou', word: 'Paused at the cap' };
  }
  if (stop !== null && !isRunning) {
    return { dot: 'failed', word: 'Failed' };
  }
  if (isRunning || isOrchestrating) {
    return { dot: 'running', word: 'Running' };
  }
  if (workflowRunOpenQuestions({ questions, run }).length > 0) {
    return { dot: 'needsYou', word: 'Needs you' };
  }
  if (agents.some((agent) => isAgentStatusHalted({ status: agent.status }))) {
    return { dot: 'failed', word: 'Failed' };
  }
  if (agents.length === 0 && run.triggerMode === 'after_run') {
    return { dot: 'idle', word: `After ${predecessorName}` };
  }
  if (agents.every((agent) => agent.status === 'pending')) {
    return { dot: 'idle', word: 'Waits to start' };
  }
  return { dot: 'needsYou', word: 'Waits for you' };
};

export const runRowFactsOf = ({
  run,
  workflow,
  agents,
  predecessorName,
  isOrchestrating,
  questions,
}: Params): RunRowFacts => ({
  ...stateOf({ run, workflow, agents, predecessorName, isOrchestrating, questions }),
  progress: progressOf({ run, workflow, agents }),
  isActive:
    run.discardedAt == null &&
    !isWorkflowRunClosedByUser({ run }) &&
    !isRunDone({ run, workflow, agents }),
});
