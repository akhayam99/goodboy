import { describe, expect, it } from 'vitest';
import {
  getAutoAttempt,
  getAutoDelegation,
  getAutoTree,
  listAutoOutbox,
  listAutoReservations,
  readAutoTreeSpend,
} from '@goodboy/db';
import {
  brandId,
  type AutoAttemptId,
  type AutoDelegationId,
  type AutoOutboxId,
} from '@goodboy/types';
import {
  batchInput,
  childInput,
  makeAutoWorld,
  secondScheduler,
  WORLD_TREE,
  type AutoWorld,
} from './testing/autoWorld';

const attemptA = brandId<AutoAttemptId>({ value: 'attempt-a' });
const attemptB = brandId<AutoAttemptId>({ value: 'attempt-b' });
const delegationA = brandId<AutoDelegationId>({ value: 'delegation-a' });

const runningWorld = async (): Promise<AutoWorld> => {
  const world = await makeAutoWorld();
  await world.scheduler.admit(
    batchInput({ children: [childInput({ key: 'a' }), childInput({ key: 'b', role: 'planner' })] }),
  );
  for (const key of ['a', 'b']) {
    const started = await world.scheduler.startAttempt({
      treeId: WORLD_TREE,
      delegationId: brandId<AutoDelegationId>({ value: `delegation-${key}` }),
      generation: 1,
      baseline: { head: 'abc123' },
      writeSet: null,
    });
    expect(started.kind).toBe('started');
    await world.scheduler.markAttemptRunning({
      attemptId: brandId<AutoAttemptId>({ value: `attempt-${key}` }),
      delegationId: brandId<AutoDelegationId>({ value: `delegation-${key}` }),
      generation: 1,
      runId: `run-${key}`,
    });
  }
  return world;
};

const completed = (costUsd: number | null) =>
  ({
    kind: 'ended',
    outcome: 'completed',
    endReason: 'ok',
    costUsd,
    resultSnapshot: { files: [] },
  }) as const;

describe('settling an attempt', () => {
  it('ends the attempt and replaces its reservation with the actual cost', async () => {
    const world = await runningWorld();
    const outcome = await world.scheduler.settleAttempt({
      attemptId: attemptA,
      generation: 1,
      ending: completed(0.2),
    });
    expect(outcome.kind).toBe('settled');
    expect(await getAutoAttempt({ db: world.db, attemptId: attemptA })).toMatchObject({
      state: 'ended',
      outcome: 'completed',
      runId: 'run-a',
      endReason: 'ok',
    });
    expect(await readAutoTreeSpend({ db: world.db, treeId: WORLD_TREE })).toMatchObject({
      settledUsd: 0.2,
      reservedUsd: 0,
      estimatedUsd: 0,
    });
  });

  it('settles an unknown cost at nothing, never at a ceiling, and marks it unknown', async () => {
    const world = await runningWorld();
    await world.scheduler.settleAttempt({
      attemptId: attemptB,
      generation: 1,
      ending: completed(null),
    });
    expect(await readAutoTreeSpend({ db: world.db, treeId: WORLD_TREE })).toMatchObject({
      settledUsd: 0,
      estimatedUsd: 0,
    });
    const reservations = await listAutoReservations({ db: world.db, treeId: WORLD_TREE });
    expect(reservations.find((row) => row.ownerId === 'attempt-b')).toMatchObject({
      state: 'reconciled',
      actualUsd: 0,
      isCostKnown: false,
    });
  });

  it('records a question without ending the delegation, and queues it in the same step', async () => {
    const world = await runningWorld();
    const outcome = await world.scheduler.settleAttempt({
      attemptId: attemptA,
      generation: 1,
      ending: { kind: 'paused', questionId: 'question-1', costUsd: 0.1, resultSnapshot: null },
      outbox: [
        {
          id: brandId<AutoOutboxId>({ value: 'outbox-q1' }),
          treeId: WORLD_TREE,
          generation: 1,
          kind: 'question',
          joinKey: 'question:question-1',
          payload: { questionId: 'question-1', text: 'which mount?' },
          nowMs: world.clock.now(),
        },
      ],
    });
    expect(outcome.kind).toBe('settled');
    expect(await getAutoAttempt({ db: world.db, attemptId: attemptA })).toMatchObject({
      state: 'paused',
      outcome: null,
      questionId: 'question-1',
    });
    expect(await getAutoDelegation({ db: world.db, delegationId: delegationA })).toMatchObject({
      state: 'paused',
      questionCycles: 1,
    });
    expect((await getAutoTree({ db: world.db, treeId: WORLD_TREE }))?.questionCycles).toBe(1);
    const outbox = await listAutoOutbox({ db: world.db, treeId: WORLD_TREE });
    expect(outbox).toEqual([expect.objectContaining({ kind: 'question', state: 'pending' })]);
  });

  it('ends as blocked when a delegation asked its fourth question', async () => {
    const world = await runningWorld();
    await world.db.execute('UPDATE auto_delegations SET question_cycles = 3 WHERE id = ?', [
      delegationA,
    ]);
    await world.scheduler.settleAttempt({
      attemptId: attemptA,
      generation: 1,
      ending: { kind: 'paused', questionId: 'question-4', costUsd: 0.1, resultSnapshot: null },
    });
    expect(await getAutoAttempt({ db: world.db, attemptId: attemptA })).toMatchObject({
      state: 'ended',
      outcome: 'blocked',
      endReason: 'question_limit',
    });
    expect((await getAutoDelegation({ db: world.db, delegationId: delegationA }))?.state).toBe(
      'running',
    );
  });
});

describe('late results are dropped', () => {
  it('drops a success that arrives after the generation changed and frees its reservation', async () => {
    const world = await runningWorld();
    await world.scheduler.transition({
      treeId: WORLD_TREE,
      expect: { phaseRev: 2, generation: 1, from: ['delegating'] },
      to: 'stopping',
      patch: { isNewGeneration: true, stopState: 'requested' },
    });
    const late = await world.scheduler.settleAttempt({
      attemptId: attemptA,
      generation: 1,
      ending: completed(0.3),
    });
    expect(late).toEqual({ kind: 'dropped', reason: 'generation' });
    expect(await getAutoAttempt({ db: world.db, attemptId: attemptA })).toMatchObject({
      state: 'running',
    });
    const reservations = await listAutoReservations({ db: world.db, treeId: WORLD_TREE });
    expect(reservations.find((row) => row.ownerId === 'attempt-a')).toMatchObject({
      state: 'released',
      releasedReason: 'stale_result',
    });
    expect((await readAutoTreeSpend({ db: world.db, treeId: WORLD_TREE }))?.settledUsd).toBe(0);
  });

  it('drops a failure that arrives after the attempt already ended, without a second charge', async () => {
    const world = await runningWorld();
    await world.scheduler.settleAttempt({
      attemptId: attemptA,
      generation: 1,
      ending: completed(0.2),
    });
    const late = await world.scheduler.settleAttempt({
      attemptId: attemptA,
      generation: 1,
      ending: {
        kind: 'ended',
        outcome: 'failed',
        endReason: 'late',
        costUsd: 9,
        resultSnapshot: null,
      },
    });
    expect(late).toEqual({ kind: 'dropped', reason: 'attempt_state' });
    expect(await getAutoAttempt({ db: world.db, attemptId: attemptA })).toMatchObject({
      outcome: 'completed',
    });
    expect((await readAutoTreeSpend({ db: world.db, treeId: WORLD_TREE }))?.settledUsd).toBe(0.2);
  });

  it('drops the second of two concurrent settles of the same attempt', async () => {
    const world = await runningWorld();
    const results = await Promise.all([
      world.scheduler.settleAttempt({ attemptId: attemptA, generation: 1, ending: completed(0.2) }),
      world.scheduler.settleAttempt({ attemptId: attemptA, generation: 1, ending: completed(0.2) }),
    ]);
    expect(results.map((result) => result.kind).sort()).toEqual(['dropped', 'settled']);
    expect((await readAutoTreeSpend({ db: world.db, treeId: WORLD_TREE }))?.settledUsd).toBe(0.2);
  });

  it('drops a result from a window that does not own the tree and changes nothing', async () => {
    const world = await runningWorld();
    const other = secondScheduler({ world });
    const late = await other.settleAttempt({
      attemptId: attemptA,
      generation: 1,
      ending: completed(0.2),
    });
    expect(late).toEqual({ kind: 'dropped', reason: 'not_owner' });
    expect(await getAutoAttempt({ db: world.db, attemptId: attemptA })).toMatchObject({
      state: 'running',
    });
    const reservations = await listAutoReservations({ db: world.db, treeId: WORLD_TREE });
    expect(reservations.every((row) => row.state === 'reserved')).toBe(true);
  });

  it('does not throw when the Auto agent was deleted before the result came', async () => {
    const world = await runningWorld();
    await world.db.execute("DELETE FROM agents WHERE id = 'agent-auto-root'");
    const late = await world.scheduler.settleAttempt({
      attemptId: attemptA,
      generation: 1,
      ending: completed(0.2),
    });
    expect(late).toEqual({ kind: 'dropped', reason: 'unknown_attempt' });
  });
});

describe('settling is one step', () => {
  it('rolls everything back when the outbox write fails, and the old state stays', async () => {
    const world = await runningWorld();
    await world.db.exec(
      `CREATE TRIGGER fail_outbox_insert BEFORE INSERT ON auto_outbox
       BEGIN SELECT RAISE(ABORT, 'outbox write failed'); END`,
    );
    await expect(
      world.scheduler.settleAttempt({
        attemptId: attemptA,
        generation: 1,
        ending: completed(0.2),
        outbox: [
          {
            id: brandId<AutoOutboxId>({ value: 'outbox-1' }),
            treeId: WORLD_TREE,
            generation: 1,
            kind: 'results',
            joinKey: 'join-1',
            payload: {},
            nowMs: world.clock.now(),
          },
        ],
      }),
    ).rejects.toThrow('outbox write failed');
    expect(await getAutoAttempt({ db: world.db, attemptId: attemptA })).toMatchObject({
      state: 'running',
    });
    const spend = await readAutoTreeSpend({ db: world.db, treeId: WORLD_TREE });
    expect(spend).toMatchObject({ settledUsd: 0, reservedUsd: 0 });
    expect(await getAutoAttempt({ db: world.db, attemptId: attemptB })).toMatchObject({
      state: 'running',
    });
  });

  it('starts an attempt once, and refuses to start it again', async () => {
    const world = await runningWorld();
    const again = await world.scheduler.startAttempt({
      treeId: WORLD_TREE,
      delegationId: delegationA,
      generation: 1,
      baseline: null,
      writeSet: null,
    });
    expect(again).toEqual({ kind: 'refused', reason: 'not_startable' });
    const missing = await world.scheduler.startAttempt({
      treeId: WORLD_TREE,
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-none' }),
      generation: 1,
      baseline: null,
      writeSet: null,
    });
    expect(missing).toEqual({ kind: 'refused', reason: 'unknown_delegation' });
  });

  it('refuses to start any attempt of a stopped generation', async () => {
    const world = await makeAutoWorld();
    await world.scheduler.admit(batchInput({ children: [childInput({ key: 'a' })] }));
    await world.scheduler.transition({
      treeId: WORLD_TREE,
      expect: { phaseRev: 2, generation: 1, from: ['delegating'] },
      to: 'stopping',
      patch: { isNewGeneration: true, stopState: 'requested' },
    });
    const start = await world.scheduler.startAttempt({
      treeId: WORLD_TREE,
      delegationId: delegationA,
      generation: 1,
      baseline: null,
      writeSet: null,
    });
    expect(start).toEqual({ kind: 'refused', reason: 'not_startable' });
    expect(await world.db.select('SELECT id FROM auto_attempts')).toEqual([]);
  });
});
