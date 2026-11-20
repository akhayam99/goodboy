import { isAgentStatusHalted } from '@goodboy/core/workflows';
import type { Agent, AgentId, OpenQuestion, Workflow, WorkflowRun } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import type { TailState } from '../../../live-state/tailFacts';
import type { NextAction } from '../../../workflows/resolveNextAction';
import { openStepLabelOf, type RunPrimary } from '../../../workflows/runPrimaryOf';
import { runStateOfPrimary } from '../../../workflows/runStateOf';
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
  readonly nextAction: NextAction;
  readonly quiet: RunQuiet | null;
  readonly selectedRootId: AgentId | null;
  readonly restartStoppedCount: number;
  readonly question: OpenQuestion | null;
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

const DECIDE_NEXT_WORD: DynamicWord = { state: 'idle', phrase: NAMES.ready };

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
  readonly primary: RunPrimary;
  readonly isStepPage: boolean;
};

const primaryTailOf = ({ run, primary, isStepPage }: PrimaryParams): RunTail => {
  const verb: RunTailVerb = { kind: 'primary', primary };
  switch (primary.kind) {
    case 'start-step':
      return { state: 'idle', phrase: NAMES.ready, stepAgentId: null, verb };
    case 'start-run':
      return run.triggerMode === 'after_run'
        ? { state: 'queued', phrase: NAMES.queued, stepAgentId: null, verb }
        : { state: 'idle', phrase: NAMES.ready, stepAgentId: null, verb };
    case 'resume':
      return {
        state: 'stopped',
        phrase: NAMES.paused,
        stepAgentId: null,
        verb: isStepPage ? verb : null,
      };
    case 'raise-cap':
      return { state: 'paused', phrase: NAMES.needsYou, stepAgentId: null, verb };
    case 'review-plan':
    case 'approve-plan':
      return { state: 'waiting', phrase: NAMES.needsApproval, stepAgentId: null, verb };
    case 'answer':
      return { state: 'waiting', phrase: NAMES.needsYou, stepAgentId: null, verb };
    case 'open-step':
      return {
        state: 'needsYou',
        phrase: NAMES.needsYou,
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
      return {
        state: 'idle',
        phrase: runStateOfPrimary({ primary: 'restore' }).word,
        stepAgentId: null,
        verb,
      };
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
  nextAction,
  quiet,
  selectedRootId,
  restartStoppedCount,
  question,
}: Params): RunTail | null => {
  if (run.discardedAt != null) {
    return null;
  }
  if (isWorkflowRunClosedByUser({ run })) {
    return { state: 'stopped', phrase: NAMES.stopped, stepAgentId: null, verb: null };
  }
  if (isCompleted) {
    return null;
  }
  const steps = agents.filter((agent) => agent.parentAgentId == null);
  if (quiet !== null) {
    return {
      state: 'needsYou',
      phrase: NAMES.needsYou,
      stepAgentId: null,
      verb: { kind: 'quiet', agentId: quiet.agentId },
    };
  }
  const running = steps.find((agent) => agent.status === 'running') ?? null;
  if (running !== null) {
    if (running.id === selectedRootId) {
      return null;
    }
    return {
      state: 'working',
      phrase: NAMES.running,
      stepAgentId: running.id,
      verb: {
        kind: 'openStep',
        agentId: running.id,
        label: openStepLabelOf({ number: stepNumberOf({ workflow, agent: running }) }),
      },
    };
  }
  if (restartStoppedCount > 0) {
    return {
      state: 'stopped',
      phrase: NAMES.stopped,
      stepAgentId: null,
      verb: { kind: 'resumeAll', count: restartStoppedCount },
    };
  }
  const stoppedTail = stoppedQuestionTailOf({ stop: run.orchestrationStop });
  if (question !== null) {
    return {
      state: stoppedTail?.state ?? 'waiting',
      phrase: stoppedTail?.phrase ?? NAMES.needsYou,
      stepAgentId: null,
      verb: { kind: 'answer', question },
    };
  }
  if (nextAction.kind === 'answer') {
    return {
      state: stoppedTail?.state ?? 'waiting',
      phrase: stoppedTail?.phrase ?? NAMES.needsYou,
      stepAgentId: null,
      verb: { kind: 'answer', question: nextAction.question },
    };
  }
  if (nextAction.kind === 'recover') {
    const halted = steps.find((agent) => isAgentStatusHalted({ status: agent.status })) ?? null;
    if (selectedRootId === null && halted !== null) {
      return {
        state: 'needsYou',
        phrase: NAMES.needsYou,
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
      phrase: nextAction.isBlocked ? NAMES.notFinished : NAMES.failed,
      stepAgentId: null,
      verb: { kind: 'recover' },
    };
  }
  if (nextAction.kind === 'summarizing') {
    return { state: 'working', phrase: NAMES.running, stepAgentId: null, verb: null };
  }
  if (run.orchestrationStop?.kind === 'budget') {
    return {
      state: 'paused',
      phrase: NAMES.needsYou,
      stepAgentId: null,
      verb: { kind: 'raiseCap' },
    };
  }
  if (primary !== null) {
    return primaryTailOf({ run, primary, isStepPage: selectedRootId !== null });
  }
  const stopped = steps.find((agent) => agent.status === 'stopped') ?? null;
  if (stopped !== null) {
    return {
      state: 'stopped',
      phrase: NAMES.stopped,
      stepAgentId: null,
      verb: { kind: 'continueStep', agentId: stopped.id },
    };
  }
  return null;
};
