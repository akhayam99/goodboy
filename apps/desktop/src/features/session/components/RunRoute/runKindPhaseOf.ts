import type { AgentStatus } from '@goodboy/types';
import type { OrchestratorPhase } from '../../../workflows/orchestratorState';

export type RunKindPhase = 'unstarted' | 'live' | 'ended' | 'finished';

type Params = {
  readonly agentCount: number;
  readonly isFinished: boolean;
  readonly phase: OrchestratorPhase | null;
  readonly status: AgentStatus | null;
};

const ENDED_PHASES: ReadonlyArray<OrchestratorPhase> = [
  'stopped',
  'failed',
  'step-failed',
  'blocked',
];

const ACTIVE_PHASES: ReadonlyArray<OrchestratorPhase> = [
  'deciding',
  'stopping',
  'automatic',
  'plan-revising',
];

const ENDED_STATUSES: ReadonlyArray<AgentStatus> = ['failed', 'blocked', 'stopped'];

const LIVE_STATUSES: ReadonlyArray<AgentStatus> = ['running', 'pending'];

export const runKindPhaseOf = ({ agentCount, isFinished, phase, status }: Params): RunKindPhase => {
  if (status !== null) {
    if (LIVE_STATUSES.includes(status)) {
      return 'live';
    }
    return ENDED_STATUSES.includes(status) ? 'ended' : 'finished';
  }
  if (phase === null) {
    return 'finished';
  }
  if (ACTIVE_PHASES.includes(phase)) {
    return 'live';
  }
  if (agentCount === 0) {
    return 'unstarted';
  }
  if (isFinished) {
    return 'finished';
  }
  return ENDED_PHASES.includes(phase) ? 'ended' : 'live';
};
