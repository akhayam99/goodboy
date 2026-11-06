import type { Agent, OpenQuestion, Workflow, WorkflowRun } from '@goodboy/types';
import { isAgentStatusHalted, isAgentStatusSettled } from '@goodboy/core/workflows';
import type { DotState } from '@goodboy/ui';
import { workflowRunOpenQuestions } from '../context/openQuestionsGate';
import { isRunPaused } from './isRunPaused';
import { isRunQueuedManual } from './isRunQueuedManual';
import { isWorkflowRunClosedByUser } from './isWorkflowRunClosedByUser';
import { runStepCountOf, runStepCountWordOf } from './runStepCountOf';
import { isRunHeldForPlan } from '../../store/slices/workflows/workflowPlanApproval';

export const READY_WORD = 'Ready';

export type RunWait = 'stopped' | 'limit' | 'go';

export type RunRowFacts = {
  readonly dot: DotState;
  readonly word: string;
  readonly wait: RunWait | null;
  readonly isWordRead: boolean;
  readonly progress: string;
  readonly isActive: boolean;
  readonly isStartable: boolean;
  readonly isQueuedManual: boolean;
  readonly isContinuable: boolean;
};

const DOT_ONLY_WORDS: ReadonlySet<string> = new Set(['Running', 'Done', 'Archived', READY_WORD]);

type Params = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly predecessorName: string;
  readonly isOrchestrating: boolean;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly isPlanRevising: boolean;
};

type StateFacts = {
  readonly dot: DotState;
  readonly word: string;
  readonly wait?: RunWait;
  readonly isContinuable?: boolean;
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
  const hasStarted = stepAgentsOf({ agents }).some((agent) => agent.status !== 'pending');
  return hasStarted ? runStepCountWordOf(runStepCountOf({ run, workflow, agents })) : '';
};

const stateOf = ({
  run,
  workflow,
  agents,
  predecessorName,
  isOrchestrating,
  questions,
  isPlanRevising,
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
    return isPlanRevising
      ? { dot: 'running', word: 'Revising plan' }
      : { dot: 'needsYou', word: 'Plan ready' };
  }
  if (stop?.kind === 'operator') {
    return isOrchestrating || isRunning
      ? { dot: 'running', word: 'Stopping' }
      : { dot: 'idle', word: 'Stopped', isContinuable: true };
  }
  if (stop?.kind === 'budget' && !isRunning) {
    return { dot: 'needsYou', word: 'Paused at the limit', wait: 'limit' };
  }
  if (stop !== null && !isRunning) {
    return stop.kind === 'failure'
      ? { dot: 'failed', word: 'Failed', wait: 'stopped' }
      : { dot: 'failed', word: 'Failed' };
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
    return { dot: 'idle', word: READY_WORD };
  }
  return { dot: 'needsYou', word: 'Waits for you', wait: 'go' };
};

export const runRowFactsOf = ({
  run,
  workflow,
  agents,
  predecessorName,
  isOrchestrating,
  questions,
  isPlanRevising,
}: Params): RunRowFacts => {
  const {
    wait = null,
    isContinuable = false,
    ...state
  } = stateOf({
    run,
    workflow,
    agents,
    predecessorName,
    isOrchestrating,
    questions,
    isPlanRevising,
  });
  return {
    ...state,
    wait,
    isWordRead: !DOT_ONLY_WORDS.has(state.word),
    progress: progressOf({ run, workflow, agents }),
    isStartable: state.word === READY_WORD && run.executionMode !== 'dynamic',
    isQueuedManual: state.word === READY_WORD && isRunQueuedManual({ run, agents }),
    isContinuable,
    isActive:
      run.discardedAt == null &&
      !isWorkflowRunClosedByUser({ run }) &&
      !isRunDone({ run, workflow, agents }),
  };
};
