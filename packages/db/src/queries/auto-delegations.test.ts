import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type AutoAttemptId,
  type AutoBatchId,
  type AutoDelegationId,
  type AutoRequestId,
  type AutoTreeId,
} from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { AUTO_SEED_NOW, seedAutoSession, seedAutoTree } from '../test-helpers/auto-seeds';
import {
  endAutoAttemptStatement,
  getAutoAttempt,
  insertAutoAttemptStatement,
  listAutoAttemptsOfDelegation,
  listLiveAutoAttempts,
  markAutoAttemptRunningStatement,
  pauseAutoAttemptStatement,
} from './auto-attempts';
import {
  casAutoDelegationStateStatement,
  getAutoDelegation,
  getOpenAutoDelegationOfChild,
  insertAutoDelegationStatement,
  listAutoDelegations,
  listAutoDelegationsOfRequest,
  listOpenAutoDelegations,
  settleAutoDelegationStatement,
  type NewAutoDelegation,
} from './auto-delegations';

const treeId = brandId<AutoTreeId>({ value: 'tree-1' });

const world = async () => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db, agentIds: ['agent-scout', 'agent-impl'] });
  await seedAutoTree({ db });
  return db;
};

type DelegationOverrides = Omit<Partial<NewAutoDelegation>, 'id'> & { readonly id: string };

const delegation = ({ id, ...rest }: DelegationOverrides): NewAutoDelegation => ({
  id: brandId<AutoDelegationId>({ value: id }),
  treeId,
  generation: 1,
  requestId: brandId<AutoRequestId>({ value: 'request-1' }),
  requestHash: 'hash-1',
  batchId: brandId<AutoBatchId>({ value: 'batch-1' }),
  slot: 0,
  childAgentId: brandId<AgentId>({ value: 'agent-scout' }),
  firstAttemptId: brandId<AutoAttemptId>({ value: `attempt-${id}` }),
  role: 'scout',
  request: { task: 'find the retry loop in notify-relay' },
  target: { mountId: 'mount-ledger-core' },
  routing: { provider: 'anthropic', model: 'sonnet' },
  state: 'accepted',
  retryOf: null,
  reviseOf: null,
  baseRevision: null,
  isAdopted: false,
  deadlineAt: AUTO_SEED_NOW + 1_800_000,
  nowMs: AUTO_SEED_NOW,
  ...rest,
});

const run = async ({
  db,
  statements,
}: {
  readonly db: Database;
  readonly statements: Parameters<Database['transaction']>[0]['statements'];
}) => db.transaction({ statements });

describe('auto delegations', () => {
  it('stores the immutable request and reads it back whole', async () => {
    const db = await world();
    await run({
      db,
      statements: [
        insertAutoDelegationStatement({ delegation: delegation({ id: 'delegation-1' }) }),
      ],
    });
    const stored = await getAutoDelegation({
      db,
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-1' }),
    });
    expect(stored).toMatchObject({
      id: 'delegation-1',
      role: 'scout',
      state: 'accepted',
      outcome: null,
      isAdopted: false,
      request: { task: 'find the retry loop in notify-relay' },
      target: { mountId: 'mount-ledger-core' },
    });
    expect(await listAutoDelegations({ db, treeId })).toHaveLength(1);
    expect(
      await listAutoDelegationsOfRequest({
        db,
        treeId,
        requestId: brandId<AutoRequestId>({ value: 'request-1' }),
      }),
    ).toHaveLength(1);
  });

  it('refuses a second slot with the same request id and slot', async () => {
    const db = await world();
    await run({
      db,
      statements: [
        insertAutoDelegationStatement({ delegation: delegation({ id: 'delegation-1' }) }),
      ],
    });
    await expect(
      run({
        db,
        statements: [
          insertAutoDelegationStatement({
            delegation: delegation({
              id: 'delegation-2',
              childAgentId: brandId<AgentId>({ value: 'agent-impl' }),
            }),
          }),
        ],
      }),
    ).rejects.toThrow();
  });

  it('lets a child own one open delegation at a time', async () => {
    const db = await world();
    await run({
      db,
      statements: [
        insertAutoDelegationStatement({ delegation: delegation({ id: 'delegation-1' }) }),
      ],
    });
    await expect(
      run({
        db,
        statements: [
          insertAutoDelegationStatement({
            delegation: delegation({
              id: 'delegation-2',
              requestId: brandId<AutoRequestId>({ value: 'request-2' }),
            }),
          }),
        ],
      }),
    ).rejects.toThrow();
    const settle = settleAutoDelegationStatement({
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-1' }),
      generation: 1,
      outcome: 'completed',
      reason: null,
      result: { summary: 'found it' },
      nowMs: AUTO_SEED_NOW + 10,
      abortCode: 'settle',
    });
    expect((await run({ db, statements: [settle] })).status).toBe('committed');
    expect((await run({ db, statements: [settle] })).status).toBe('aborted');
    await run({
      db,
      statements: [
        insertAutoDelegationStatement({
          delegation: delegation({
            id: 'delegation-2',
            requestId: brandId<AutoRequestId>({ value: 'request-2' }),
          }),
        }),
      ],
    });
    expect((await listOpenAutoDelegations({ db, treeId })).map((item) => item.id)).toEqual([
      'delegation-2',
    ]);
    const open = await getOpenAutoDelegationOfChild({
      db,
      childAgentId: brandId<AgentId>({ value: 'agent-scout' }),
    });
    expect(open?.id).toBe('delegation-2');
    const settled = await getAutoDelegation({
      db,
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-1' }),
    });
    expect(settled).toMatchObject({
      state: 'settled',
      outcome: 'completed',
      result: { summary: 'found it' },
    });
  });

  it('moves a state only from the expected one and the current generation', async () => {
    const db = await world();
    await run({
      db,
      statements: [
        insertAutoDelegationStatement({ delegation: delegation({ id: 'delegation-1' }) }),
      ],
    });
    const move = (generation: number) =>
      casAutoDelegationStateStatement({
        delegationId: brandId<AutoDelegationId>({ value: 'delegation-1' }),
        generation,
        from: ['accepted'],
        to: 'starting',
        abortCode: 'cas',
      });
    expect((await run({ db, statements: [move(2)] })).status).toBe('aborted');
    expect((await run({ db, statements: [move(1)] })).status).toBe('committed');
    expect((await run({ db, statements: [move(1)] })).status).toBe('aborted');
  });
});

describe('auto attempts', () => {
  const attemptStatement = (id: string, generation = 1) =>
    insertAutoAttemptStatement({
      id: brandId<AutoAttemptId>({ value: id }),
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-1' }),
      treeId,
      generation,
      baseline: { head: 'abc123' },
      writeSet: null,
      nowMs: AUTO_SEED_NOW,
    });

  it('numbers attempts in order and ends each one once', async () => {
    const db = await world();
    await run({
      db,
      statements: [
        insertAutoDelegationStatement({ delegation: delegation({ id: 'delegation-1' }) }),
      ],
    });
    await run({ db, statements: [attemptStatement('attempt-a')] });
    const running = markAutoAttemptRunningStatement({
      attemptId: brandId<AutoAttemptId>({ value: 'attempt-a' }),
      generation: 1,
      runId: 'run-1',
      abortCode: 'running',
    });
    expect((await run({ db, statements: [running] })).status).toBe('committed');
    expect((await run({ db, statements: [running] })).status).toBe('aborted');
    expect((await listLiveAutoAttempts({ db, treeId })).map((item) => item.id)).toEqual([
      'attempt-a',
    ]);

    const end = (generation: number) =>
      endAutoAttemptStatement({
        attemptId: brandId<AutoAttemptId>({ value: 'attempt-a' }),
        generation,
        outcome: 'completed',
        endReason: 'ok',
        resultSnapshot: { files: [] },
        nowMs: AUTO_SEED_NOW + 5,
        abortCode: 'end',
      });
    expect((await run({ db, statements: [end(2)] })).status).toBe('aborted');
    expect((await run({ db, statements: [end(1)] })).status).toBe('committed');
    expect((await run({ db, statements: [end(1)] })).status).toBe('aborted');

    await run({ db, statements: [attemptStatement('attempt-b')] });
    const attempts = await listAutoAttemptsOfDelegation({
      db,
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-1' }),
    });
    expect(attempts.map((item) => [item.id, item.ordinal, item.state, item.outcome])).toEqual([
      ['attempt-a', 1, 'ended', 'completed'],
      ['attempt-b', 2, 'starting', null],
    ]);
  });

  it('pauses on a question without ending, and keeps the question id', async () => {
    const db = await world();
    await run({
      db,
      statements: [
        insertAutoDelegationStatement({ delegation: delegation({ id: 'delegation-1' }) }),
      ],
    });
    await run({ db, statements: [attemptStatement('attempt-a')] });
    const pause = pauseAutoAttemptStatement({
      attemptId: brandId<AutoAttemptId>({ value: 'attempt-a' }),
      generation: 1,
      questionId: 'question-1',
      resultSnapshot: null,
      nowMs: AUTO_SEED_NOW + 5,
      abortCode: 'pause',
    });
    expect((await run({ db, statements: [pause] })).status).toBe('committed');
    expect(
      await getAutoAttempt({ db, attemptId: brandId<AutoAttemptId>({ value: 'attempt-a' }) }),
    ).toMatchObject({
      state: 'paused',
      outcome: null,
      questionId: 'question-1',
    });
  });
});
