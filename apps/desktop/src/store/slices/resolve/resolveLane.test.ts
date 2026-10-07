import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  MountId,
  ResolveAttempt,
  ResolveCandidate,
  SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  attemptOfCandidate,
  laneChainOf,
  laneHolderOf,
  laneQueueOf,
  laneTipOf,
  lanePathsOf,
} from './resolveLane';

const PATH_A = '/repo/ledger-core';
const PATH_B = '/repo/payments-api';

const candidateOf = ({
  id,
  revision,
  baseSha,
  candidateSha,
  worktreePath = PATH_A,
  state = 'ready',
  integratedSha = null,
}: {
  readonly id: string;
  readonly revision: number;
  readonly baseSha: string;
  readonly candidateSha: string;
  readonly worktreePath?: string;
  readonly state?: ResolveCandidate['state'];
  readonly integratedSha?: string | null;
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
    integratedSha,
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
}): ResolveAttempt => ({
  id,
  sessionId: 's' as SessionId,
  agentId: `agent-${id}` as AgentId,
  prNumber: 7,
  threadIds: [`thread-${id}`],
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  instructions: null,
  phase,
  mountTarget: { mountId: 'm' as MountId, mountRevision: 1, worktreePath: path },
  startedAt: null,
  endedAt: null,
  error: null,
  createdAt,
  batchId,
  copyPath: null,
  launchChoice: null,
});

const agentOf = ({
  id,
  doneAt,
}: {
  readonly id: string;
  readonly doneAt?: Agent['doneAt'];
}): Agent =>
  anAgent({ id: id as AgentId, status: 'running', ...(doneAt === undefined ? {} : { doneAt }) });

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

describe('laneChainOf on a base that is gone', () => {
  const idsOf = (entries: ReadonlyArray<{ readonly candidate: ResolveCandidate }>) =>
    entries.map(({ candidate }) => candidate.id);

  it('breaks every fix built on a refused first fix, so none heads the chain', () => {
    const candidates = [
      candidateOf({
        id: 'one',
        revision: 1,
        baseSha: 'root',
        candidateSha: 'c1',
        state: 'discarded',
      }),
      candidateOf({ id: 'two', revision: 2, baseSha: 'c1', candidateSha: 'c2' }),
      candidateOf({ id: 'three', revision: 3, baseSha: 'c2', candidateSha: 'c3' }),
    ];

    const { chain, broken } = laneChainOf({ candidates, worktreePath: PATH_A });

    expect(idsOf(chain)).toEqual([]);
    expect(idsOf(broken)).toEqual(['two', 'three']);
    expect(laneTipOf({ candidates, worktreePath: PATH_A })).toBeNull();
  });

  it('breaks a fix built on a stale fix', () => {
    const candidates = [
      candidateOf({ id: 'one', revision: 1, baseSha: 'root', candidateSha: 'c1', state: 'stale' }),
      candidateOf({ id: 'two', revision: 2, baseSha: 'c1', candidateSha: 'c2' }),
    ];

    expect(idsOf(laneChainOf({ candidates, worktreePath: PATH_A }).broken)).toEqual(['two']);
  });

  it('breaks a fix built on one the branch took as a copy under another commit', () => {
    const candidates = [
      candidateOf({
        id: 'one',
        revision: 1,
        baseSha: 'root',
        candidateSha: 'c1',
        state: 'integrated',
        integratedSha: 'moved-c1',
      }),
      candidateOf({ id: 'two', revision: 2, baseSha: 'c1', candidateSha: 'c2' }),
    ];

    expect(idsOf(laneChainOf({ candidates, worktreePath: PATH_A }).broken)).toEqual(['two']);
  });

  it('keeps a fix built on one the branch took as it was', () => {
    const candidates = [
      candidateOf({
        id: 'one',
        revision: 1,
        baseSha: 'root',
        candidateSha: 'c1',
        state: 'integrated',
        integratedSha: 'c1',
      }),
      candidateOf({ id: 'two', revision: 2, baseSha: 'c1', candidateSha: 'c2' }),
    ];

    const { chain, broken } = laneChainOf({ candidates, worktreePath: PATH_A });

    expect(idsOf(chain)).toEqual(['two']);
    expect(broken).toEqual([]);
  });

  it('keeps a fix built on a commit a discarded parent shares with a live split', () => {
    const candidates = [
      candidateOf({
        id: 'run',
        revision: 1,
        baseSha: 'root',
        candidateSha: 'c2',
        state: 'discarded',
      }),
      candidateOf({ id: 'run-1', revision: 2, baseSha: 'root', candidateSha: 'c1' }),
      candidateOf({ id: 'run-2', revision: 3, baseSha: 'c1', candidateSha: 'c2' }),
      candidateOf({ id: 'next', revision: 4, baseSha: 'c2', candidateSha: 'c3' }),
    ];

    const { chain, broken } = laneChainOf({ candidates, worktreePath: PATH_A });

    expect(idsOf(chain)).toEqual(['run-1', 'run-2', 'next']);
    expect(broken).toEqual([]);
  });

  it('ignores a discarded candidate that never made a commit', () => {
    const candidates = [
      candidateOf({
        id: 'empty',
        revision: 1,
        baseSha: 'root',
        candidateSha: 'root',
        state: 'discarded',
      }),
      candidateOf({ id: 'one', revision: 2, baseSha: 'root', candidateSha: 'c1' }),
    ];

    expect(idsOf(laneChainOf({ candidates, worktreePath: PATH_A }).chain)).toEqual(['one']);
  });

  it('does not mix up the commits of another branch', () => {
    const candidates = [
      candidateOf({
        id: 'elsewhere',
        revision: 1,
        baseSha: 'root',
        candidateSha: 'c1',
        state: 'discarded',
        worktreePath: PATH_B,
      }),
      candidateOf({ id: 'two', revision: 2, baseSha: 'c1', candidateSha: 'c2' }),
    ];

    expect(idsOf(laneChainOf({ candidates, worktreePath: PATH_A }).chain)).toEqual(['two']);
  });
});

describe('attemptOfCandidate', () => {
  const attempts = [
    attemptOf({ id: 'run-1', phase: 'finished', path: PATH_A, createdAt: 1 }),
    attemptOf({ id: 'run-2-3', phase: 'finished', path: PATH_A, createdAt: 2 }),
  ];

  it('finds the attempt of a candidate by its own id', () => {
    expect(attemptOfCandidate({ attempts, candidateId: 'run-1' })?.id).toBe('run-1');
  });

  it('finds the attempt of a split fix, named after it with a number', () => {
    expect(attemptOfCandidate({ attempts, candidateId: 'run-1-3' })?.id).toBe('run-1');
    expect(attemptOfCandidate({ attempts, candidateId: 'run-2-3-1' })?.id).toBe('run-2-3');
  });

  it('finds nothing for an id that is no attempt and no split of one', () => {
    expect(attemptOfCandidate({ attempts, candidateId: 'run-1-x' })).toBeNull();
    expect(attemptOfCandidate({ attempts, candidateId: 'other' })).toBeNull();
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
    const agents = [agentOf({ id: 'agent-waits' })];

    expect(laneHolderOf({ attempts, agents, worktreePath: PATH_A })?.id).toBe('waits');
    expect(laneHolderOf({ attempts, agents, worktreePath: PATH_B })).toBeNull();
    expect(
      laneHolderOf({
        attempts,
        agents: [
          agentOf({ id: 'agent-waits', doneAt: '2026-10-06T10:00:00.000Z' as Agent['doneAt'] }),
        ],
        worktreePath: PATH_A,
      }),
    ).toBeNull();
  });
});
