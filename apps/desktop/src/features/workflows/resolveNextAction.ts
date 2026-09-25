import { findReusableAgent } from '@goodboy/core';
import type { Agent, AgentId, OpenQuestion, Step, Workflow, WorkflowRun } from '@goodboy/types';
import type { WorkflowAdvanceState } from './advanceGate';
import { isWorkflowRunClosedByUser } from './isWorkflowRunClosedByUser';

export type NextAction =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'answer';
      readonly subjectAgentId: AgentId | null;
      readonly question: OpenQuestion;
      readonly sentence: string;
      readonly cause: string;
    }
  | {
      readonly kind: 'recover';
      readonly subjectAgentId: AgentId;
      readonly step: Step;
      readonly sentence: string;
      readonly cause: string;
    }
  | {
      readonly kind: 'summarizing';
      readonly subjectAgentId: null;
      readonly sentence: string;
      readonly cause: string;
    };

type Params = {
  readonly advance: WorkflowAdvanceState;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly subjectAgentId: AgentId | null;
};

const NONE: NextAction = { kind: 'none' };

const MAX_NAMED_STEPS = 2;

const sortedSteps = ({ workflow }: { readonly workflow: Workflow }): ReadonlyArray<Step> =>
  [...workflow.steps].sort((a, b) => a.ordinal - b.ordinal);

const waitingCause = ({
  workflow,
  step,
  isDynamic,
}: {
  readonly workflow: Workflow;
  readonly step: Step;
  readonly isDynamic: boolean;
}): string => {
  if (isDynamic) {
    return 'Nothing advances until this step is checked or skipped.';
  }
  const later = sortedSteps({ workflow })
    .filter((candidate) => candidate.ordinal > step.ordinal)
    .map((candidate) => candidate.name);
  if (later.length === 0) {
    return 'The run finishes once this step is done.';
  }
  if (later.length === 1) {
    return `${later[0]} waits on this step.`;
  }
  if (later.length === MAX_NAMED_STEPS) {
    return `${later[0]} and ${later[1]} wait on this step.`;
  }
  return `${later[0]}, ${later[1]} and ${later.length - MAX_NAMED_STEPS} more wait on this step.`;
};

const answerAction = ({
  advance,
  run,
  agents,
  questions,
}: Omit<Params, 'subjectAgentId' | 'workflow'>): NextAction | null => {
  const question = questions[0];
  if (question == null) {
    return null;
  }
  const isDynamic = run.executionMode === 'dynamic';
  if (advance.kind === 'complete' && (!isDynamic || run.orchestrationOutcome === 'done')) {
    return null;
  }
  const asker =
    question.createdByAgentId != null
      ? (agents.find((agent) => agent.id === question.createdByAgentId) ?? null)
      : null;
  const waitingStep = advance.kind === 'complete' ? null : advance.step;
  const waiting =
    waitingStep === null
      ? 'The orchestrator waits on your answer.'
      : asker?.stepId === waitingStep.id
        ? 'This step waits on your answer.'
        : `${waitingStep.name} waits on your answer.`;
  const more = questions.length > 1 ? ` ${questions.length} questions are open.` : '';
  return {
    kind: 'answer',
    subjectAgentId: asker?.id ?? null,
    question,
    sentence: `${asker?.name ?? 'An agent'} asks: ${question.text.trim()}`,
    cause: `${waiting}${more}`,
  };
};

const failedStepOf = ({ advance }: { readonly advance: WorkflowAdvanceState }): Step | null => {
  switch (advance.kind) {
    case 'complete':
    case 'automatic':
    case 'ready':
      return null;
    case 'blocked':
      return advance.failedStep;
    default: {
      const unexpected: never = advance;
      return unexpected;
    }
  }
};

const recoverAction = ({
  advance,
  run,
  workflow,
  agents,
  subjectAgentId,
}: Omit<Params, 'questions'>): NextAction | null => {
  const step = failedStepOf({ advance });
  if (step == null) {
    return null;
  }
  const stepAgents = agents.filter((agent) => agent.parentAgentId == null && agent.stepId != null);
  const failedAgent = findReusableAgent(stepAgents, step.id);
  if (failedAgent == null || failedAgent.status !== 'failed') {
    return null;
  }
  if (subjectAgentId != null && subjectAgentId !== failedAgent.id) {
    return null;
  }
  return {
    kind: 'recover',
    subjectAgentId: failedAgent.id,
    step,
    sentence: `${step.name} stopped before finishing.`,
    cause: waitingCause({ workflow, step, isDynamic: run.executionMode === 'dynamic' }),
  };
};

const summarizingAction = ({
  advance,
  workflow,
}: Pick<Params, 'advance' | 'workflow'>): NextAction | null => {
  if (advance.kind !== 'blocked' || advance.reason !== 'summarizer') {
    return null;
  }
  const previous = sortedSteps({ workflow })
    .filter((candidate) => candidate.ordinal < advance.step.ordinal)
    .at(-1);
  return {
    kind: 'summarizing',
    subjectAgentId: null,
    sentence:
      previous != null
        ? `Writing the next brief from ${previous.name}.`
        : 'Writing the next brief.',
    cause: `${advance.step.name} starts from it once it is ready.`,
  };
};

export const resolveNextAction = ({
  advance,
  run,
  workflow,
  agents,
  questions,
  subjectAgentId,
}: Params): NextAction => {
  if (run.discardedAt != null || isWorkflowRunClosedByUser({ run })) {
    return NONE;
  }
  if (subjectAgentId != null) {
    return recoverAction({ advance, run, workflow, agents, subjectAgentId }) ?? NONE;
  }
  return (
    answerAction({ advance, run, agents, questions }) ??
    recoverAction({ advance, run, workflow, agents, subjectAgentId }) ??
    summarizingAction({ advance, workflow }) ??
    NONE
  );
};
