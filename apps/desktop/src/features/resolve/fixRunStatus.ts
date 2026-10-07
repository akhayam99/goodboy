import type { AgentId, ResolveAttempt, TurnState } from '@goodboy/types';

export type FixRunStatus = 'queued' | 'working' | 'waiting' | 'ended';

export type FixRunCommitsView = 'list' | 'none' | 'hidden';

export const fixRunStatusOf = ({
  attempts,
  agentId,
  turnKind,
}: {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly agentId: AgentId;
  readonly turnKind: TurnState['kind'] | null;
}): FixRunStatus => {
  if (turnKind === 'ended') {
    return 'ended';
  }
  const phases = attempts
    .filter((attempt) => attempt.agentId === agentId)
    .map((attempt) => attempt.phase);
  if (phases.includes('waiting')) {
    return 'waiting';
  }
  if (phases.includes('running')) {
    return 'working';
  }
  return phases.includes('queued') ? 'queued' : 'ended';
};

export const fixRunCommitsViewOf = ({
  commitCount,
  status,
  isLoaded,
}: {
  readonly commitCount: number;
  readonly status: FixRunStatus;
  readonly isLoaded: boolean;
}): FixRunCommitsView => {
  if (commitCount > 0) {
    return 'list';
  }
  return status === 'ended' && isLoaded ? 'none' : 'hidden';
};
