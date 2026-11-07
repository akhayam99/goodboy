import { isAgentStatusHalted } from '@goodboy/core/workflows';
import type { Agent, AgentId, OpenQuestion, Workflow, WorkflowRun } from '@goodboy/types';
import type { TailState } from '../../../live-state/tailFacts';
import type { NextAction } from '../../../workflows/resolveNextAction';
import { openStepLabelOf, type RunPrimary } from '../../../workflows/runPrimaryOf';
import { runStateOfPrimary } from '../../../workflows/runStateOf';
import { NOT_FINISHED } from '../../../workTreeModel/rowStateCopy';
import { isWorkflowRunClosedByUser } from '../../../workflows/isWorkflowRunClosedByUser';
import { stepNumberOf } from './stepNumberOf';
import { stoppedQuestionTailOf } from './stoppedQuestionTailOf';

export type RunTailVerb =
  | { readonly kind: 'primary'; readonly primary: RunPrimary }
  | { readonly kind: 'raiseCap' }
  | { readonly kind: 'answer'; readonly question: OpenQuestion }
  | { readonly kind: 'recover' }
  | { readonly kind: 'quiet'; readonly agentId: AgentId }
  | { readonly kind: 'openStep'; readonly agentId: AgentId; readonly label: string }
  | { readonly kind: 'continueStep'; readonly agentId: AgentId }
  | { readonly kind: 'resumeAll'; readonly count: number }
  | { readonly kind: 'openRun' };

export type RunTail = {
  readonly state: TailState;
  readonly phrase: string;
  readonly stepAgentId: AgentId | null;
  readonly verb: RunTailVerb | null;
};

type RunQuiet = {
  readonly agentId: AgentId;
  readonly minutes: number;
};

type Params = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly isCompleted: boolean;
  readonly primary: RunPrimary | null;
  readonly predecessorName: string;
  readonly nextAction: NextAction;
  readonly quiet: RunQuiet | null;
  readonly selectedRootId: AgentId | null;
  readonly roleById: ReadonlyMap<AgentId, string>;
  readonly restartStoppedCount: number;
  readonly question: OpenQuestion | null;
};

type StepParams = {
  readonly workflow: Workflow;
  readonly agent: Agent;
};

type LabelParams = StepParams & {
  readonly roleById: ReadonlyMap<AgentId, string>;
};

const stepLabelOf = ({ workflow, agent, roleById }: LabelParams): string => {
  const number = stepNumberOf({ workflow, agent });
  const role = roleById.get(agent.id) ?? agent.name;
  return number === null ? role : `Step ${number} · ${role}`;
};

type DynamicWord = {
  readonly state: TailState;
  readonly phrase: string;
};

type DynamicParams = {
  readonly kind: 'continue' | 'retry' | 'hint' | 'decide-next';
};

const dynamicStateOf = ({ kind }: DynamicParams): TailState => {
  if (kind === 'continue') {
    return 'stopped';
  }
  return kind === 'retry' ? 'failed' : 'needsYou';
};

const DECIDE_NEXT_WORD: DynamicWord = { state: 'idle', phrase: 'Ready' };

const dynamicWordOf = ({ kind }: DynamicParams): DynamicWord => {
  if (kind === 'decide-next') {
    return DECIDE_NEXT_WORD;
  }
  return {
    state: dynamicStateOf({ kind }),
    phrase: runStateOfPrimary({ primary: kind }).pageWord,
  };
};

type PrimaryParams = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly primary: RunPrimary;
  readonly predecessorName: string;
  readonly isStepPage: boolean;
};

const primaryTailOf = ({
  run,
  workflow,
  agents,
  primary,
  predecessorName,
  isStepPage,
}: PrimaryParams): RunTail => {
  const verb: RunTailVerb = { kind: 'primary', primary };
  switch (primary.kind) {
    case 'start-step': {
      const done = agents
        .filter((agent) => agent.parentAgentId == null && agent.status === 'completed')
        .map((agent) => stepNumberOf({ workflow, agent }))
        .filter((number): number is number => number !== null);
      const last = done.length === 0 ? null : Math.max(...done);
      const doneWords = `Step ${last} done`;
      return {
        state: 'idle',
        phrase:
          last === null
            ? 'Ready to start'
            : isStepPage
              ? doneWords
              : `${doneWords} · ready to continue`,
        stepAgentId: null,
        verb,
      };
    }
    case 'start-run':
      return run.triggerMode === 'after_run'
        ? {
            state: 'queued',
            phrase: `Starts after ${predecessorName}`,
            stepAgentId: null,
            verb,
          }
        : { state: 'idle', phrase: 'Ready to start', stepAgentId: null, verb };
    case 'resume':
      return {
        state: 'stopped',
        phrase: 'Paused by you',
        stepAgentId: null,
        verb: isStepPage ? verb : null,
      };
    case 'raise-cap':
      return { state: 'paused', phrase: 'Paused at the limit', stepAgentId: null, verb };
    case 'review-plan':
    case 'approve-plan':
      return {
        state: 'waiting',
        phrase: 'The plan needs approval',
        stepAgentId: null,
        verb,
      };
    case 'answer':
      return {
        state: 'waiting',
        phrase: runStateOfPrimary({ primary: 'answer' }).pageWord,
        stepAgentId: null,
        verb,
      };
    case 'open-step':
      return {
        state: 'needsYou',
        phrase: runStateOfPrimary({ primary: 'open-step' }).pageWord,
        stepAgentId: null,
        verb: isStepPage ? { kind: 'openRun' } : verb,
      };
    case 'continue':
    case 'retry':
    case 'hint':
    case 'decide-next':
      return {
        ...dynamicWordOf({ kind: primary.kind }),
        stepAgentId: null,
        verb: isStepPage ? { kind: 'openRun' } : verb,
      };
    case 'restore':
      return { state: 'idle', phrase: primary.label, stepAgentId: null, verb };
    default: {
      const exhaustive: never = primary.kind;
      return exhaustive;
    }
  }
};

export const runTailOf = ({
  run,
  workflow,
  agents,
  isCompleted,
  primary,
  predecessorName,
  nextAction,
  quiet,
  selectedRootId,
  roleById,
  restartStoppedCount,
  question,
}: Params): RunTail | null => {
  if (run.discardedAt != null) {
    return null;
  }
  if (isWorkflowRunClosedByUser({ run })) {
    return { state: 'stopped', phrase: 'Stopped by you', stepAgentId: null, verb: null };
  }
  if (isCompleted) {
    return null;
  }
  const steps = agents.filter((agent) => agent.parentAgentId == null);
  if (quiet !== null) {
    return {
      state: 'waiting',
      phrase: `No output for ${quiet.minutes} min`,
      stepAgentId: null,
      verb: { kind: 'quiet', agentId: quiet.agentId },
    };
  }
  const running = steps.find((agent) => agent.status === 'running') ?? null;
  if (running !== null) {
    if (running.id === selectedRootId) {
      return null;
    }
    const number = stepNumberOf({ workflow, agent: running });
    return {
      state: 'working',
      phrase: `${stepLabelOf({ workflow, agent: running, roleById })} is working`,
      stepAgentId: running.id,
      verb: {
        kind: 'openStep',
        agentId: running.id,
        label: number === null ? 'Open step' : `Open step ${number}`,
      },
    };
  }
  if (restartStoppedCount > 0) {
    return {
      state: 'stopped',
      phrase:
        restartStoppedCount === 1
          ? '1 agent stopped by restart'
          : `${restartStoppedCount} agents stopped by restart`,
      stepAgentId: null,
      verb: { kind: 'resumeAll', count: restartStoppedCount },
    };
  }
  const stoppedTail = stoppedQuestionTailOf({ stop: run.orchestrationStop });
  if (question !== null) {
    return {
      state: stoppedTail?.state ?? 'waiting',
      phrase: stoppedTail?.phrase ?? runStateOfPrimary({ primary: 'answer' }).pageWord,
      stepAgentId: null,
      verb: { kind: 'answer', question },
    };
  }
  if (nextAction.kind === 'answer') {
    return {
      state: stoppedTail?.state ?? 'waiting',
      phrase: stoppedTail?.phrase ?? nextAction.sentence,
      stepAgentId: null,
      verb: { kind: 'answer', question: nextAction.question },
    };
  }
  if (nextAction.kind === 'recover') {
    const halted = steps.find((agent) => isAgentStatusHalted({ status: agent.status })) ?? null;
    if (selectedRootId === null && halted !== null) {
      return {
        state: 'needsYou',
        phrase: runStateOfPrimary({ primary: 'open-step' }).pageWord,
        stepAgentId: null,
        verb: {
          kind: 'openStep',
          agentId: halted.id,
          label: openStepLabelOf({ number: stepNumberOf({ workflow, agent: halted }) }),
        },
      };
    }
    return {
      state: nextAction.isBlocked ? 'needsYou' : 'failed',
      phrase: nextAction.isBlocked ? NOT_FINISHED : nextAction.sentence,
      stepAgentId: null,
      verb: { kind: 'recover' },
    };
  }
  if (nextAction.kind === 'summarizing') {
    return { state: 'working', phrase: 'Preparing the next step', stepAgentId: null, verb: null };
  }
  if (run.orchestrationStop?.kind === 'budget') {
    return {
      state: 'paused',
      phrase: 'Paused at the limit',
      stepAgentId: null,
      verb: { kind: 'raiseCap' },
    };
  }
  if (primary !== null) {
    return primaryTailOf({
      run,
      workflow,
      agents,
      primary,
      predecessorName,
      isStepPage: selectedRootId !== null,
    });
  }
  const stopped = steps.find((agent) => agent.status === 'stopped') ?? null;
  if (stopped !== null) {
    return {
      state: 'stopped',
      phrase: `${stepLabelOf({ workflow, agent: stopped, roleById })} stopped`,
      stepAgentId: null,
      verb: { kind: 'continueStep', agentId: stopped.id },
    };
  }
  return null;
};
