import { isAgentStatusHalted } from '@goodboy/core/workflows';
import type { Agent, AgentId } from '@goodboy/types';
import type { MountBlockedStep } from '../../store/slices/workflows/runMount/selectMountBlockedStep';
import type { TailState } from '../live-state/tailFacts';
import type { OrchestratorPhase, OrchestratorState } from './orchestratorState';
import { NAMES } from '../../shared/utils/names';
import { decisionFailureOf } from './decisionFailureOf';
import type { RunPrimary } from './runPrimaryOf';

export type OrchestratedVerb =
  | { readonly kind: 'primary'; readonly primary: RunPrimary }
  | { readonly kind: 'continueStep'; readonly agentId: AgentId }
  | { readonly kind: 'viewTranscript'; readonly agentId: AgentId }
  | { readonly kind: 'readQueued'; readonly count: number; readonly isStopped: boolean }
  | { readonly kind: 'quiet'; readonly agentId: AgentId }
  | { readonly kind: 'resumeAll'; readonly count: number };

type OrchestratedQuiet = {
  readonly agentId: AgentId;
  readonly minutes: number;
};

export type OrchestratedTail = {
  readonly state: TailState;
  readonly phrase: string;
  readonly stepAgentId: AgentId | null;
  readonly blockedAgentId: AgentId | null;
  readonly verbs: ReadonlyArray<OrchestratedVerb>;
};

type Params = {
  readonly orchestrator: OrchestratorState;
  readonly agents: ReadonlyArray<Agent>;
  readonly primary: RunPrimary | null;
  readonly queuedCount: number;
  readonly isDiscarded: boolean;
  readonly quiet: OrchestratedQuiet | null;
  readonly restartStoppedCount: number;
  readonly mountBlock?: MountBlockedStep | null;
};

const TAIL_STATE: Readonly<Record<OrchestratorPhase, TailState>> = {
  deciding: 'working',
  automatic: 'working',
  'plan-revising': 'working',
  stopping: 'working',
  waiting: 'waiting',
  'ready-first': 'idle',
  'ready-mid': 'idle',
  'needs-answer': 'waiting',
  'needs-approval': 'waiting',
  'plan-approval': 'waiting',
  'plan-question': 'waiting',
  paused: 'stopped',
  'paused-budget': 'paused',
  stopped: 'stopped',
  'step-failed': 'needsYou',
  failed: 'failed',
  blocked: 'failed',
  done: 'idle',
};

type PrimaryParams = {
  readonly primary: RunPrimary | null;
};

const primaryVerbs = ({ primary }: PrimaryParams): ReadonlyArray<OrchestratedVerb> =>
  primary === null || primary.kind === 'resume' || primary.kind === 'hint'
    ? []
    : [{ kind: 'primary', primary }];

type PhraseParams = {
  readonly orchestrator: OrchestratorState;
};

const phraseOf = ({ orchestrator }: PhraseParams): string => {
  const failure = decisionFailureOf({ orchestrator });
  return failure === null ? orchestrator.sentence : `${orchestrator.sentence}: ${failure}`;
};

export const orchestratedTailOf = ({
  orchestrator,
  agents,
  primary,
  queuedCount,
  isDiscarded,
  quiet,
  restartStoppedCount,
  mountBlock = null,
}: Params): OrchestratedTail | null => {
  if (isDiscarded) {
    return null;
  }
  const phase = orchestrator.phase;
  if (quiet !== null && phase === 'waiting') {
    return {
      state: 'waiting',
      phrase: `No output for ${quiet.minutes} min`,
      stepAgentId: null,
      blockedAgentId: null,
      verbs: [{ kind: 'quiet', agentId: quiet.agentId }],
    };
  }
  if (restartStoppedCount > 0 && phase !== 'done') {
    return {
      state: 'stopped',
      phrase:
        restartStoppedCount === 1
          ? '1 agent stopped when Goodboy closed'
          : `${restartStoppedCount} agents stopped when Goodboy closed`,
      stepAgentId: null,
      blockedAgentId: null,
      verbs: [{ kind: 'resumeAll', count: restartStoppedCount }],
    };
  }
  const roots = agents
    .filter((agent) => agent.parentAgentId == null)
    .sort((left, right) => left.ordinal - right.ordinal);
  const base = {
    state: TAIL_STATE[orchestrator.phase],
    phrase: phraseOf({ orchestrator }),
    stepAgentId: null,
    blockedAgentId: null,
  };
  if (phase === 'waiting') {
    const running = roots.find((agent) => agent.status === 'running');
    if (running !== undefined && orchestrator.waitingOnAgentId === running.id) {
      return {
        ...base,
        state: 'working',
        stepAgentId: running.id,
        verbs: [],
      };
    }
    const stopped = roots.find((agent) => agent.status === 'stopped');
    if (stopped !== undefined) {
      return { ...base, state: 'stopped', verbs: [{ kind: 'continueStep', agentId: stopped.id }] };
    }
    return { ...base, verbs: [] };
  }
  if (phase === 'step-failed') {
    const halted = [...agents]
      .sort((left, right) => left.ordinal - right.ordinal)
      .find((agent) => isAgentStatusHalted({ status: agent.status }));
    const isMountBlocked =
      halted !== undefined && halted.status === 'blocked' && mountBlock?.agentId === halted.id;
    return {
      ...base,
      phrase: NAMES.needsYou,
      blockedAgentId: isMountBlocked ? halted.id : null,
      verbs: [],
    };
  }
  if (phase === 'failed' || phase === 'blocked') {
    const last = roots.at(-1);
    const transcript: ReadonlyArray<OrchestratedVerb> =
      last === undefined ? [] : [{ kind: 'viewTranscript', agentId: last.id }];
    return { ...base, verbs: [...primaryVerbs({ primary }), ...transcript] };
  }
  if (phase === 'stopped' && queuedCount > 0) {
    return { ...base, verbs: [{ kind: 'readQueued', count: queuedCount, isStopped: true }] };
  }
  if (phase === 'done') {
    return {
      ...base,
      verbs: queuedCount > 0 ? [{ kind: 'readQueued', count: queuedCount, isStopped: false }] : [],
    };
  }
  if (phase === 'needs-answer') {
    return { ...base, verbs: [] };
  }
  return { ...base, verbs: primaryVerbs({ primary }) };
};
