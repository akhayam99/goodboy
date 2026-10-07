import type { Agent, ResolveAttempt, ResolveCandidate } from '@goodboy/types';
import { hasLaunchTurns } from './launchTurns';
import { launchKeyOf } from './resolveLaunch';

type Chained = { readonly candidate: ResolveCandidate };

type AttemptsParams = {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly worktreePath: string;
};

type HolderParams = AttemptsParams & { readonly agents: ReadonlyArray<Agent> };

type ChainParams<T extends Chained> = {
  readonly candidates: ReadonlyArray<T>;
  readonly worktreePath: string;
};

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

const isLanded = ({ candidate }: Chained): boolean =>
  candidate.state === 'integrated' && candidate.integratedSha === candidate.candidateSha;

const isCopiedElsewhere = ({ candidate }: Chained): boolean =>
  candidate.state === 'integrated' &&
  candidate.integratedSha !== null &&
  candidate.integratedSha !== candidate.candidateSha;

const goneShasOf = <T extends Chained>({
  candidates,
  worktreePath,
}: ChainParams<T>): Set<string> => {
  const own = candidates.filter((entry) => entry.candidate.worktreePath === worktreePath);
  const live = new Set(
    own
      .filter((entry) => entry.candidate.state === 'ready' || isLanded(entry))
      .map(({ candidate }) => candidate.candidateSha),
  );
  return new Set(
    own
      .filter(
        (entry) =>
          entry.candidate.candidateSha !== entry.candidate.baseSha &&
          (entry.candidate.state === 'discarded' ||
            entry.candidate.state === 'stale' ||
            isCopiedElsewhere(entry)),
      )
      .map(({ candidate }) => candidate.candidateSha)
      .filter((sha) => !live.has(sha)),
  );
};

export const laneChainOf = <T extends Chained>({
  candidates,
  worktreePath,
}: ChainParams<T>): { readonly chain: ReadonlyArray<T>; readonly broken: ReadonlyArray<T> } => {
  const ready = candidates
    .filter(
      ({ candidate }) => candidate.state === 'ready' && candidate.worktreePath === worktreePath,
    )
    .sort((left, right) => left.candidate.revision - right.candidate.revision);
  const gone = goneShasOf({ candidates, worktreePath });
  const chain: Array<T> = [];
  const broken: Array<T> = [];
  let expected: string | null = null;
  for (const entry of ready) {
    const isBuiltOnGone = gone.has(entry.candidate.baseSha);
    if (!isBuiltOnGone && (expected === null || entry.candidate.baseSha === expected)) {
      chain.push(entry);
      expected = entry.candidate.candidateSha;
      continue;
    }
    broken.push(entry);
    gone.add(entry.candidate.candidateSha);
  }
  return { chain, broken };
};

type AttemptOfParams = {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly candidateId: string;
};

export const attemptOfCandidate = ({
  attempts,
  candidateId,
}: AttemptOfParams): ResolveAttempt | null =>
  attempts.find((attempt) => attempt.id === candidateId) ??
  attempts.find(
    (attempt) =>
      candidateId.startsWith(`${attempt.id}-`) &&
      /^\d+$/.test(candidateId.slice(attempt.id.length + 1)),
  ) ??
  null;

export const laneTipOf = <T extends Chained>(params: ChainParams<T>): string | null =>
  laneChainOf(params).chain.at(-1)?.candidate.candidateSha ?? null;

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
