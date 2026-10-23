import type { Agent, AgentId, IsoDateTime } from '@goodboy/types';
import type { TailState } from '../live-state/tailFacts';
import type {
  OrchestratorPhase,
  OrchestratorState,
} from './components/OrchestratorStrip/orchestratorState';
import { modelNamesIn } from './modelNamesIn';
import type { RunPrimary } from './runPrimaryOf';

export type OrchestratedVerb =
  | { readonly kind: 'primary'; readonly primary: RunPrimary }
  | { readonly kind: 'stopStep'; readonly agent: Agent; readonly number: number }
  | { readonly kind: 'continueStep'; readonly agentId: AgentId }
  | { readonly kind: 'restartStep' }
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
  'step-failed': 'failed',
  failed: 'failed',
  blocked: 'failed',
  done: 'idle',
};

type PrimaryParams = {
  readonly primary: RunPrimary | null;
};

const primaryVerbs = ({ primary }: PrimaryParams): ReadonlyArray<OrchestratedVerb> =>
  primary === null || primary.kind === 'resume' ? [] : [{ kind: 'primary', primary }];

type PhraseParams = {
  readonly orchestrator: OrchestratorState;
};

const phraseOf = ({ orchestrator }: PhraseParams): string => {
  const detail = orchestrator.detail?.trim() ?? '';
  if (orchestrator.phase !== 'failed' || detail === '') {
    return orchestrator.sentence;
  }
  return `${orchestrator.sentence}: ${modelNamesIn({ text: detail })}`;
};

export const orchestratedTailOf = ({
  orchestrator,
  agents,
  primary,
  queuedCount,
  isDiscarded,
  quiet,
  restartStoppedCount,
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
  };
  if (phase === 'waiting') {
    const runningIndex = roots.findIndex((agent) => agent.status === 'running');
    const running = roots[runningIndex];
    if (running !== undefined && orchestrator.waitingOnAgentId === running.id) {
      return {
        ...base,
        state: 'working',
        stepAgentId: running.id,
        verbs: [{ kind: 'stopStep', agent: running, number: runningIndex + 1 }],
      };
    }
    const stopped = roots.find((agent) => agent.status === 'stopped');
    if (stopped !== undefined) {
      return { ...base, state: 'stopped', verbs: [{ kind: 'continueStep', agentId: stopped.id }] };
    }
    return { ...base, verbs: [] };
  }
  if (phase === 'step-failed') {
    return { ...base, verbs: [{ kind: 'restartStep' }] };
  }
  if (phase === 'failed') {
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
  return { ...base, verbs: primaryVerbs({ primary }) };
};
