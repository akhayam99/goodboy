import type { Agent, Step } from '@goodboy/types';
import type { WorkflowAdvanceState } from '../../workflows/advanceGate';
import type { TimelineAgentEntry, TimelineRunEntry } from './buildTimelineGroups';

type Params = {
  readonly entry: TimelineRunEntry;
};

export type RunStepCounts = {
  readonly started: number;
  readonly total: number | null;
};

export const runStepCounts = ({ entry }: Params): RunStepCounts => {
  const started = entry.children.filter(
    (child) => child.kind === 'agent' && child.agent.status !== 'pending',
  ).length;
  const total =
    entry.run.executionMode === 'dynamic'
      ? null
      : entry.workflow.steps.filter((step) => step.deletedAt == null).length;
  return { started, total };
};

export const runStepProgress = ({ entry }: Params): string | null => {
  const { started, total } = runStepCounts({ entry });
  if (total === 0) {
    return null;
  }
  if (started === 0) {
    if (total == null) {
      return null;
    }
    return total === 1 ? '1 step' : `${total} steps`;
  }
  if (total == null) {
    return `Step ${started}`;
  }
  return `Step ${Math.min(started, total)} of ${total}`;
};

export type RunStepState = 'done' | 'running' | 'waiting' | 'failed' | 'notStarted';

type StatesParams = {
  readonly entry: TimelineRunEntry;
  readonly advance: WorkflowAdvanceState | null;
};

type StepStateParams = {
  readonly step: Step;
  readonly child: TimelineAgentEntry | null;
  readonly advance: WorkflowAdvanceState | null;
};

const stateOfStatus = ({ status }: Pick<Agent, 'status'>): RunStepState => {
  switch (status) {
    case 'running':
      return 'running';
    case 'completed':
    case 'skipped':
      return 'done';
    case 'failed':
      return 'failed';
    case 'blocked':
      return 'waiting';
    case 'pending':
    case 'stopped':
      return 'notStarted';
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
};

const stepStateOf = ({ step, child, advance }: StepStateParams): RunStepState => {
  if (advance?.kind === 'blocked' && advance.failedStep?.id === step.id) {
    return 'failed';
  }
  if (
    advance?.kind === 'blocked' &&
    advance.reason === 'questions' &&
    advance.step.id === step.id
  ) {
    return 'waiting';
  }
  if (advance?.kind === 'ready' && advance.step.id === step.id) {
    return 'waiting';
  }
  if (child === null) {
    return 'notStarted';
  }
  if (child.openQuestions.length > 0) {
    return 'waiting';
  }
  return stateOfStatus({ status: child.agent.status });
};

export const runStepStates = ({ entry, advance }: StatesParams): ReadonlyArray<RunStepState> =>
  entry.workflow.steps
    .filter((step) => step.deletedAt == null)
    .map((step) =>
      stepStateOf({
        step,
        child:
          entry.children.find(
            (candidate): candidate is TimelineAgentEntry =>
              candidate.kind === 'agent' && candidate.agent.stepId === step.id,
          ) ?? null,
        advance,
      }),
    );
