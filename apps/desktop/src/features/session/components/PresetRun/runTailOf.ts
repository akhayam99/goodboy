import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  Workflow,
  WorkflowRun,
} from '@goodboy/types';
import type { TailState } from '../../../live-state/tailFacts';
import type { NextAction } from '../../../workflows/resolveNextAction';
import type { RunPrimary } from '../../../workflows/runPrimaryOf';
import { isWorkflowRunClosedByUser } from '../../../workflows/isWorkflowRunClosedByUser';

export type RunTailVerb =
  | { readonly kind: 'primary'; readonly primary: RunPrimary }
  | { readonly kind: 'raiseCap' }
  | { readonly kind: 'answer'; readonly question: OpenQuestion }
  | { readonly kind: 'recover' }
  | { readonly kind: 'quiet'; readonly agentId: AgentId }
  | { readonly kind: 'openStep'; readonly agentId: AgentId; readonly label: string }
  | { readonly kind: 'continueStep'; readonly agentId: AgentId }
  | { readonly kind: 'addStep' }
  | { readonly kind: 'resumeAll'; readonly count: number };

export type RunTail = {
  readonly state: TailState;
  readonly phrase: string;
  readonly startedAt: IsoDateTime | null;
  readonly verb: RunTailVerb | null;
};

export type RunQuiet = {
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

const stepNumberOf = ({ workflow, agent }: StepParams): number | null => {
  const index = [...workflow.steps]
    .sort((left, right) => left.ordinal - right.ordinal)
    .findIndex((step) => step.id === agent.stepId);
  return index < 0 ? null : index + 1;
};

type LabelParams = StepParams & {
  readonly roleById: ReadonlyMap<AgentId, string>;
};

const stepLabelOf = ({ workflow, agent, roleById }: LabelParams): string => {
  const number = stepNumberOf({ workflow, agent });
  const role = roleById.get(agent.id) ?? agent.name;
  return number === null ? role : `Step ${number} · ${role}`;
};

type PrimaryParams = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly primary: RunPrimary;
  readonly predecessorName: string;
};

const primaryTailOf = ({
  run,
  workflow,
  agents,
  primary,
  predecessorName,
}: PrimaryParams): RunTail => {
  const verb: RunTailVerb = { kind: 'primary', primary };
  switch (primary.kind) {
    case 'start-step': {
      const done = agents
        .filter((agent) => agent.parentAgentId == null && agent.status === 'completed')
        .map((agent) => stepNumberOf({ workflow, agent }))
        .filter((number): number is number => number !== null);
      const last = done.length === 0 ? null : Math.max(...done);
      return {
        state: 'idle',
        phrase: last === null ? 'Ready to start' : `Step ${last} done · ready to continue`,
        startedAt: null,
        verb,
      };
    }
    case 'start-run':
      return {
        state: 'queued',
        phrase:
          run.triggerMode === 'after_run' ? `Starts after ${predecessorName}` : 'Waits to start',
        startedAt: null,
        verb,
      };
    case 'resume':
      return { state: 'stopped', phrase: 'Paused by you', startedAt: null, verb };
    case 'raise-cap':
      return { state: 'paused', phrase: 'Paused at the spend cap', startedAt: null, verb };
    case 'review-plan':
    case 'approve-plan':
      return { state: 'waiting', phrase: 'The plan waits for your review', startedAt: null, verb };
    case 'answer':
      return { state: 'waiting', phrase: 'Waiting for your answer', startedAt: null, verb };
    case 'continue':
    case 'retry':
    case 'decide-next':
    case 'restore':
      return { state: 'idle', phrase: primary.label, startedAt: null, verb };
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
    return { state: 'idle', phrase: 'Archived run', startedAt: null, verb: null };
  }
  if (isWorkflowRunClosedByUser({ run })) {
    return {
      state: 'stopped',
      phrase: 'Stopped by you',
      startedAt: null,
      verb: { kind: 'addStep' },
    };
  }
  if (isCompleted) {
    return { state: 'idle', phrase: 'Run finished', startedAt: null, verb: { kind: 'addStep' } };
  }
  const steps = agents.filter((agent) => agent.parentAgentId == null);
  if (quiet !== null) {
    return {
      state: 'waiting',
      phrase: `No output for ${quiet.minutes} min`,
      startedAt: null,
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
      startedAt: running.startedAt ?? null,
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
          ? '1 agent stopped when Goodboy closed'
          : `${restartStoppedCount} agents stopped when Goodboy closed`,
      startedAt: null,
      verb: { kind: 'resumeAll', count: restartStoppedCount },
    };
  }
  if (question !== null) {
    return {
      state: 'waiting',
      phrase: 'Waiting for your answer',
      startedAt: null,
      verb: { kind: 'answer', question },
    };
  }
  if (nextAction.kind === 'answer') {
    return {
      state: 'waiting',
      phrase: nextAction.sentence,
      startedAt: null,
      verb: { kind: 'answer', question: nextAction.question },
    };
  }
  if (nextAction.kind === 'recover') {
    return {
      state: 'failed',
      phrase: nextAction.sentence,
      startedAt: null,
      verb: { kind: 'recover' },
    };
  }
  if (nextAction.kind === 'summarizing') {
    return { state: 'working', phrase: 'Writing the next brief', startedAt: null, verb: null };
  }
  if (run.orchestrationStop?.kind === 'budget') {
    return {
      state: 'paused',
      phrase: 'Paused at the spend cap',
      startedAt: null,
      verb: { kind: 'raiseCap' },
    };
  }
  if (primary !== null) {
    return primaryTailOf({ run, workflow, agents, primary, predecessorName });
  }
  const stopped = steps.find((agent) => agent.status === 'stopped') ?? null;
  if (stopped !== null) {
    return {
      state: 'stopped',
      phrase: `${stepLabelOf({ workflow, agent: stopped, roleById })} stopped`,
      startedAt: null,
      verb: { kind: 'continueStep', agentId: stopped.id },
    };
  }
  return null;
};
