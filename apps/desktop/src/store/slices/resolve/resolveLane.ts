import type { Agent, ResolveAttempt, ResolveCandidate } from '@goodboy/types';
import { hasLaunchTurns } from './launchTurns';
import { launchKeyOf } from './resolveLaunch';

type Chained = { readonly candidate: ResolveCandidate };

export type ResolveLane<T extends Chained> = {
  readonly worktreePath: string;
  readonly holder: ResolveAttempt | null;
  readonly queued: ReadonlyArray<ResolveAttempt>;
  readonly chain: ReadonlyArray<T>;
  readonly broken: ReadonlyArray<T>;
};

type AttemptsParams = {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly worktreePath: string;
};

type HolderParams = AttemptsParams & { readonly agents: ReadonlyArray<Agent> };

type ChainParams<T extends Chained> = {
  readonly candidates: ReadonlyArray<T>;
  readonly worktreePath: string;
};

type LaneParams<T extends Chained> = ChainParams<T> & HolderParams;

export const attemptLanePathOf = ({
  attempt,
}: {
  readonly attempt: ResolveAttempt;
}): string | null =>
  attempt.batchId === null ? null : (attempt.mountTarget?.worktreePath ?? null);

const isParked = ({ agent }: { readonly agent: Agent | undefined }): boolean =>
  agent === undefined || agent.doneAt != null || agent.status === 'skipped';

const latestPerAgent = ({
  attempts,
}: {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
}): ReadonlyArray<ResolveAttempt> => {
  const latest = new Map<string, ResolveAttempt>();
  for (const attempt of attempts) {
    latest.set(attempt.agentId, attempt);
  }
  return [...latest.values()];
};

export const laneHolderOf = ({
  attempts,
  agents,
  worktreePath,
}: HolderParams): ResolveAttempt | null =>
  latestPerAgent({ attempts }).find((attempt) => {
    if (attemptLanePathOf({ attempt }) !== worktreePath) {
      return false;
    }
    if (isParked({ agent: agents.find((agent) => agent.id === attempt.agentId) })) {
      return false;
    }
    return (
      attempt.phase === 'running' ||
      attempt.phase === 'waiting' ||
      hasLaunchTurns({ launchId: launchKeyOf({ attempt }) })
    );
  }) ?? null;

export const laneQueueOf = ({
  attempts,
  worktreePath,
}: AttemptsParams): ReadonlyArray<ResolveAttempt> =>
  attempts
    .filter(
      (attempt) => attempt.phase === 'queued' && attemptLanePathOf({ attempt }) === worktreePath,
    )
    .sort((left, right) => left.createdAt - right.createdAt);

export const laneChainOf = <T extends Chained>({
  candidates,
  worktreePath,
}: ChainParams<T>): { readonly chain: ReadonlyArray<T>; readonly broken: ReadonlyArray<T> } => {
  const ready = candidates
    .filter(
      ({ candidate }) => candidate.state === 'ready' && candidate.worktreePath === worktreePath,
    )
    .sort((left, right) => left.candidate.revision - right.candidate.revision);
  const chain: Array<T> = [];
  const broken: Array<T> = [];
  let expected: string | null = null;
  for (const entry of ready) {
    if (expected === null || entry.candidate.baseSha === expected) {
      chain.push(entry);
      expected = entry.candidate.candidateSha;
      continue;
    }
    broken.push(entry);
  }
  return { chain, broken };
};

export const laneTipOf = <T extends Chained>(params: ChainParams<T>): string | null =>
  laneChainOf(params).chain.at(-1)?.candidate.candidateSha ?? null;

export const laneOf = <T extends Chained>({
  attempts,
  agents,
  candidates,
  worktreePath,
}: LaneParams<T>): ResolveLane<T> => ({
  worktreePath,
  holder: laneHolderOf({ attempts, agents, worktreePath }),
  queued: laneQueueOf({ attempts, worktreePath }),
  ...laneChainOf({ candidates, worktreePath }),
});

export const lanePathsOf = ({
  attempts,
}: {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
}): ReadonlyArray<string> => [
  ...new Set(
    attempts.flatMap((attempt) => {
      const path = attemptLanePathOf({ attempt });
      return path === null ? [] : [path];
    }),
  ),
];
