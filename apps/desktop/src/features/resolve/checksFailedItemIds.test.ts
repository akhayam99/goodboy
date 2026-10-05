// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  ResolveCandidate,
  ResolveCandidateState,
  ResolveCheckRun,
  SessionId,
} from '@goodboy/types';
import { checksFailedItemIds } from './checksFailedItemIds';

const candidate = (id: string, state: ResolveCandidateState): ResolveCandidate => ({
  id,
  sessionId: 'session' as SessionId,
  revision: 1,
  baseSha: 'base',
  candidateSha: 'tip',
  worktreePath: '/repos/payments-api',
  mountTarget: null,
  state,
  integratedSha: null,
  createdAt: 1,
  updatedAt: 1,
});

const run = (over: Partial<ResolveCheckRun>): ResolveCheckRun => ({
  id: 'run',
  sessionId: 'session' as SessionId,
  candidateId: 'c1',
  command: 'pnpm test',
  testIdentity: null,
  breadth: 'full',
  baseTree: 'base',
  candidateTree: 'tip',
  acceptedSet: [],
  outcome: 'failed',
  exitCode: 1,
  durationMs: 10,
  logRef: null,
  createdAt: 10,
  ...over,
});

const members = (candidateId: string, ...queueItemIds: ReadonlyArray<string>) => ({
  candidate: candidate(candidateId, 'ready'),
  items: queueItemIds.map((queueItemId) => ({ candidateId, queueItemId, itemRevision: 1 })),
});

describe('checksFailedItemIds', () => {
  it('flags the items of a ready change whose latest check on the change failed', () => {
    const ids = checksFailedItemIds({
      candidates: [members('c1', 'item-a', 'item-b')],
      checkRuns: [
        run({ outcome: 'passed', createdAt: 5 }),
        run({ outcome: 'failed', createdAt: 9 }),
      ],
    });
    expect([...ids].sort()).toEqual(['item-a', 'item-b']);
  });

  it('lets a later passing run clear the flag', () => {
    const ids = checksFailedItemIds({
      candidates: [members('c1', 'item-a')],
      checkRuns: [
        run({ outcome: 'failed', createdAt: 5 }),
        run({ outcome: 'passed', createdAt: 9 }),
      ],
    });
    expect(ids.size).toBe(0);
  });

  it('counts an errored run as failed checks', () => {
    expect(
      checksFailedItemIds({
        candidates: [members('c1', 'item-a')],
        checkRuns: [run({ outcome: 'errored' })],
      }).has('item-a'),
    ).toBe(true);
  });

  it('ignores a failing run on the base tree, a change that is not ready and a change nobody ran', () => {
    const ids = checksFailedItemIds({
      candidates: [
        members('c1', 'item-a'),
        {
          candidate: candidate('c2', 'stale'),
          items: [{ candidateId: 'c2', queueItemId: 'item-b', itemRevision: 1 }],
        },
        members('c3', 'item-c'),
      ],
      checkRuns: [run({ candidateId: 'c1', candidateTree: null }), run({ candidateId: 'c2' })],
    });
    expect(ids.size).toBe(0);
  });
});
