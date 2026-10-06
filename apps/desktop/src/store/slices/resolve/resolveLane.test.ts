import { describe, expect, it } from 'vitest';
import type { ResolveAttempt, ResolveCandidate, SessionId } from '@goodboy/types';
import { laneChainOf, laneHolderOf, laneQueueOf, laneTipOf, lanePathsOf } from './resolveLane';

const PATH_A = '/repo/ledger-core';
const PATH_B = '/repo/payments-api';

const candidateOf = ({
  id,
  revision,
  baseSha,
  candidateSha,
  worktreePath = PATH_A,
  state = 'ready',
}: {
  readonly id: string;
  readonly revision: number;
  readonly baseSha: string;
  readonly candidateSha: string;
  readonly worktreePath?: string;
  readonly state?: ResolveCandidate['state'];
}): { readonly candidate: ResolveCandidate } => ({
  candidate: {
    id,
    sessionId: 's' as SessionId,
    revision,
    baseSha,
    candidateSha,
    worktreePath,
    mountTarget: null,
    state,
    integratedSha: null,
    createdAt: revision,
    updatedAt: revision,
  },
});

const attemptOf = ({
  id,
  phase,
  path,
  batchId = 'batch-1',
  createdAt,
}: {
  readonly id: string;
  readonly phase: ResolveAttempt['phase'];
  readonly path: string;
  readonly batchId?: string | null;
  readonly createdAt: number;
}): ResolveAttempt =>
  ({
    id,
    sessionId: 's',
    agentId: `agent-${id}`,
    threadIds: [`thread-${id}`],
    phase,
    batchId,
    createdAt,
    mountTarget: { mountId: 'm', mountRevision: 1, worktreePath: path },
  }) as unknown as ResolveAttempt;

describe('laneChainOf', () => {
  it('chains ready candidates by base and keeps the first of fixes built side by side', () => {
    const candidates = [
      candidateOf({ id: 'one', revision: 1, baseSha: 'root', candidateSha: 'c1' }),
      candidateOf({ id: 'two', revision: 2, baseSha: 'c1', candidateSha: 'c2' }),
      candidateOf({ id: 'beside', revision: 3, baseSha: 'root', candidateSha: 'c3' }),
    ];

    const { chain, broken } = laneChainOf({ candidates, worktreePath: PATH_A });

    expect(chain.map(({ candidate }) => candidate.id)).toEqual(['one', 'two']);
    expect(broken.map(({ candidate }) => candidate.id)).toEqual(['beside']);
    expect(laneTipOf({ candidates, worktreePath: PATH_A })).toBe('c2');
  });

  it('ignores other branches and candidates that are not ready', () => {
    const candidates = [
      candidateOf({ id: 'one', revision: 1, baseSha: 'root', candidateSha: 'c1' }),
      candidateOf({
        id: 'gone',
        revision: 2,
        baseSha: 'c1',
        candidateSha: 'c2',
        state: 'discarded',
      }),
      candidateOf({
        id: 'other',
        revision: 3,
        baseSha: 'root',
        candidateSha: 'c9',
        worktreePath: PATH_B,
      }),
    ];

    expect(laneChainOf({ candidates, worktreePath: PATH_A }).chain).toHaveLength(1);
    expect(laneTipOf({ candidates, worktreePath: PATH_B })).toBe('c9');
    expect(laneTipOf({ candidates: [], worktreePath: PATH_A })).toBeNull();
  });
});

describe('lane attempts', () => {
  it('queues attempts of a lane in the order they were made and leaves single comment runs out', () => {
    const attempts = [
      attemptOf({ id: 'late', phase: 'queued', path: PATH_A, createdAt: 3 }),
      attemptOf({ id: 'early', phase: 'queued', path: PATH_A, createdAt: 1 }),
      attemptOf({ id: 'other', phase: 'queued', path: PATH_B, createdAt: 2 }),
      attemptOf({ id: 'legacy', phase: 'queued', path: PATH_A, batchId: null, createdAt: 0 }),
    ];

    expect(laneQueueOf({ attempts, worktreePath: PATH_A }).map((attempt) => attempt.id)).toEqual([
      'early',
      'late',
    ]);
    expect(lanePathsOf({ attempts })).toEqual([PATH_A, PATH_B]);
  });

  it('finds the holder among running and waiting attempts only', () => {
    const attempts = [
      attemptOf({ id: 'done', phase: 'finished', path: PATH_A, createdAt: 1 }),
      attemptOf({ id: 'waits', phase: 'waiting', path: PATH_A, createdAt: 2 }),
    ];
    const agents = [{ id: 'agent-waits', doneAt: null, status: 'running' }] as never;

    expect(laneHolderOf({ attempts, agents, worktreePath: PATH_A })?.id).toBe('waits');
    expect(laneHolderOf({ attempts, agents, worktreePath: PATH_B })).toBeNull();
    expect(
      laneHolderOf({
        attempts,
        agents: [{ id: 'agent-waits', doneAt: '2026-10-06', status: 'completed' }] as never,
        worktreePath: PATH_A,
      }),
    ).toBeNull();
  });
});
