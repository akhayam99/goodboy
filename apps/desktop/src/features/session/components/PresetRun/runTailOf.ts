import type { Agent, AgentId, OpenQuestion, Workflow, WorkflowRun } from '@goodboy/types';
import type { TailState } from '../../../live-state/tailFacts';
import type { NextAction } from '../../../workflows/resolveNextAction';
import type { RunPrimary } from '../../../workflows/runPrimaryOf';
import { isWorkflowRunClosedByUser } from '../../../workflows/isWorkflowRunClosedByUser';
import { stepNumberOf } from './stepNumberOf';

export type RunTailVerb =
  | { readonly kind: 'primary'; readonly primary: RunPrimary }
  | { readonly kind: 'raiseCap' }
  | { readonly kind: 'answer'; readonly question: OpenQuestion }
  | { readonly kind: 'recover' }
  | { readonly kind: 'quiet'; readonly agentId: AgentId }
  | { readonly kind: 'openStep'; readonly agentId: AgentId; readonly label: string }
  | { readonly kind: 'continueStep'; readonly agentId: AgentId }
  | { readonly kind: 'resumeAll'; readonly count: number };

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
        stepAgentId: null,
        verb,
      };
    }
    case 'start-run':
      return {
        state: 'queued',
        phrase:
          run.triggerMode === 'after_run' ? `Starts after ${predecessorName}` : 'Waits to start',
        stepAgentId: null,
        verb,
      };
    case 'resume':
      return { state: 'stopped', phrase: 'Paused by you', stepAgentId: null, verb: null };
    case 'raise-cap':
      return { state: 'paused', phrase: 'Paused at the limit', stepAgentId: null, verb };
    case 'review-plan':
    case 'approve-plan':
      return {
        state: 'waiting',
        phrase: 'The plan waits for your review',
        stepAgentId: null,
        verb,
      };
    case 'answer':
      return { state: 'waiting', phrase: 'Waiting for your answer', stepAgentId: null, verb };
    case 'continue':
    case 'retry':
    case 'hint':
    case 'decide-next':
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
    return { state: 'idle', phrase: 'Run finished', stepAgentId: null, verb: null };
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
          ? '1 agent stopped when Goodboy closed'
          : `${restartStoppedCount} agents stopped when Goodboy closed`,
      stepAgentId: null,
      verb: { kind: 'resumeAll', count: restartStoppedCount },
    };
  }
  if (question !== null) {
    return {
      state: 'waiting',
      phrase: 'Waiting for your answer',
      stepAgentId: null,
      verb: { kind: 'answer', question },
    };
  }
  if (nextAction.kind === 'answer') {
    return {
      state: 'waiting',
      phrase: nextAction.sentence,
      stepAgentId: null,
      verb: { kind: 'answer', question: nextAction.question },
    };
  }
  if (nextAction.kind === 'recover') {
    return {
      state: 'failed',
      phrase: nextAction.sentence,
      stepAgentId: null,
      verb: { kind: 'recover' },
    };
  }
  if (nextAction.kind === 'summarizing') {
    return { state: 'working', phrase: 'Writing the next brief', stepAgentId: null, verb: null };
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
    return primaryTailOf({ run, workflow, agents, primary, predecessorName });
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
