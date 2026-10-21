import { describe, expect, it } from 'vitest';
import {
  getAutoTree,
  listAutoReservations,
  listAutoTreesToRecover,
  setAutoTreeCapIfUnchanged,
} from '@goodboy/db';
import { brandId, type AutoAttemptId, type AutoDelegationId } from '@goodboy/types';
import { createAutoScheduler } from './scheduler';
import {
  batchInput,
  childInput,
  makeAutoWorld,
  secondScheduler,
  WORLD_TREE,
} from './testing/autoWorld';

describe('one scheduler owns a tree at a time', () => {
  it('lets the first window own it and keeps the second read only', async () => {
    const world = await makeAutoWorld({ isDeciding: false });
    const other = secondScheduler({ world });
    expect(await other.claim({ treeId: WORLD_TREE })).toBe(false);
    const moved = await other.transition({
      treeId: WORLD_TREE,
      expect: { phaseRev: 0, generation: 1, from: ['answering'] },
      to: 'deciding',
    });
    expect(moved).toEqual({ kind: 'lost', reason: 'not_owner' });
    const tree = await getAutoTree({ db: world.db, treeId: WORLD_TREE });
    expect(tree).toMatchObject({ phase: 'answering', schedulerOwner: 'window-a' });
  });

  it('renews the lease for its owner and hands it over only after it ran out', async () => {
    const world = await makeAutoWorld({ isDeciding: false });
    const other = secondScheduler({ world });
    world.clock.advance({ ms: 20_000 });
    expect(await world.scheduler.claim({ treeId: WORLD_TREE })).toBe(true);
    world.clock.advance({ ms: 20_000 });
    expect(await other.claim({ treeId: WORLD_TREE })).toBe(false);
    world.clock.advance({ ms: 10_000 });
    expect(await other.claim({ treeId: WORLD_TREE })).toBe(true);
    const old = await world.scheduler.transition({
      treeId: WORLD_TREE,
      expect: { phaseRev: 0, generation: 1, from: ['answering'] },
      to: 'deciding',
    });
    expect(old).toEqual({ kind: 'lost', reason: 'not_owner' });
  });

  it('lets exactly one of two windows recovering at once take the tree', async () => {
    const world = await makeAutoWorld({ isDeciding: false });
    await world.scheduler.release({ treeId: WORLD_TREE });
    const left = secondScheduler({ world, ownerId: 'window-left' });
    const right = secondScheduler({ world, ownerId: 'window-right' });
    const claims = await Promise.all([
      left.claim({ treeId: WORLD_TREE }),
      right.claim({ treeId: WORLD_TREE }),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it('applies one transition when two windows race for the same revision', async () => {
    const world = await makeAutoWorld({ isDeciding: false });
    const results = await Promise.all([
      world.scheduler.transition({
        treeId: WORLD_TREE,
        expect: { phaseRev: 0, generation: 1, from: ['answering'] },
        to: 'deciding',
        patch: { activeRunId: 'run-1' },
      }),
      world.scheduler.transition({
        treeId: WORLD_TREE,
        expect: { phaseRev: 0, generation: 1, from: ['answering'] },
        to: 'blocked',
        patch: { blockedReason: 'needs a decision' },
      }),
    ]);
    expect(results.map((result) => result.kind).sort()).toEqual(['applied', 'lost']);
    const lost = results.find((result) => result.kind === 'lost');
    expect(lost).toEqual({ kind: 'lost', reason: 'stale' });
  });
});

describe('a restart keeps what the tree counted', () => {
  it('shows the same counters to a new scheduler and lists the tree to recover', async () => {
    const world = await makeAutoWorld();
    await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a' }), childInput({ key: 'b' })] }),
    );
    const before = await getAutoTree({ db: world.db, treeId: WORLD_TREE });

    const restarted = createAutoScheduler({
      db: world.db,
      ownerId: 'window-after',
      now: world.clock.now,
    });
    expect(await restarted.claim({ treeId: WORLD_TREE })).toBe(false);
    world.clock.advance({ ms: 31_000 });
    expect(await restarted.claim({ treeId: WORLD_TREE })).toBe(true);

    const after = await getAutoTree({ db: world.db, treeId: WORLD_TREE });
    expect(after).toMatchObject({
      phase: 'delegating',
      generation: 1,
      delegationsUsed: 2,
      attemptsUsed: 2,
      turnDelegateCalls: 1,
      refusalsUsed: before?.refusalsUsed,
      schedulerOwner: 'window-after',
    });
    const toRecover = await listAutoTreesToRecover({ db: world.db });
    expect(toRecover.map((tree) => tree.id)).toEqual([WORLD_TREE]);
    const budget = await restarted.budget({ treeId: WORLD_TREE });
    expect(budget?.facts).toMatchObject({ reservedUsd: 0, remainingUsd: 5 });
  });

  it('does not reset the lifetime counters when a new turn starts or a user message arrives', async () => {
    const world = await makeAutoWorld();
    await world.scheduler.admit(batchInput({ children: [childInput({ key: 'a' })] }));
    await world.scheduler.transition({
      treeId: WORLD_TREE,
      expect: { phaseRev: 2, generation: 1, from: ['delegating'] },
      to: 'deciding',
      patch: { isYieldRequested: false, isNewTurn: true },
    });
    const tree = await getAutoTree({ db: world.db, treeId: WORLD_TREE });
    expect(tree).toMatchObject({
      turnsUsed: 2,
      turnDelegateCalls: 0,
      delegationsUsed: 1,
      attemptsUsed: 1,
    });
  });
});

describe('the budget cap changes only from the value that was seen', () => {
  it('keeps the old cap when two windows change it from the same value', async () => {
    const world = await makeAutoWorld();
    const first = await setAutoTreeCapIfUnchanged({
      db: world.db,
      treeId: WORLD_TREE,
      expectedCapUsd: 5,
      capUsd: 8,
      nowMs: world.clock.now(),
    });
    const second = await setAutoTreeCapIfUnchanged({
      db: world.db,
      treeId: WORLD_TREE,
      expectedCapUsd: 5,
      capUsd: 2,
      nowMs: world.clock.now(),
    });
    expect([first, second]).toEqual([{ kind: 'applied' }, { kind: 'stale', capUsd: 8 }]);
    expect((await getAutoTree({ db: world.db, treeId: WORLD_TREE }))?.capUsd).toBe(8);
  });

  it('refuses a cap under what is spent, checked in the same write', async () => {
    const world = await makeAutoWorld({ capUsd: 5 });
    const seenCap = (await getAutoTree({ db: world.db, treeId: WORLD_TREE }))?.capUsd;
    const admitted = await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a', role: 'implementer' })] }),
    );
    expect(admitted.kind).toBe('accepted');
    const attemptId = brandId<AutoAttemptId>({ value: 'attempt-a' });
    const delegationId = brandId<AutoDelegationId>({ value: 'delegation-a' });
    await world.scheduler.startAttempt({
      treeId: WORLD_TREE,
      delegationId,
      generation: 1,
      baseline: null,
      writeSet: null,
    });
    await world.scheduler.markAttemptRunning({
      attemptId,
      delegationId,
      generation: 1,
      runId: 'run-a',
    });
    await world.scheduler.settleAttempt({
      attemptId,
      generation: 1,
      ending: {
        kind: 'ended',
        outcome: 'completed',
        endReason: 'ok',
        costUsd: 3,
        resultSnapshot: null,
      },
    });
    const lowered = await setAutoTreeCapIfUnchanged({
      db: world.db,
      treeId: WORLD_TREE,
      expectedCapUsd: seenCap ?? 5,
      capUsd: 1,
      nowMs: world.clock.now(),
    });
    expect(lowered).toEqual({ kind: 'below_used', usedUsd: 3 });
    expect((await getAutoTree({ db: world.db, treeId: WORLD_TREE }))?.capUsd).toBe(5);
  });

  it('keeps the phase revision, so a running turn does not lose its next step', async () => {
    const world = await makeAutoWorld();
    const before = await getAutoTree({ db: world.db, treeId: WORLD_TREE });
    await setAutoTreeCapIfUnchanged({
      db: world.db,
      treeId: WORLD_TREE,
      expectedCapUsd: 5,
      capUsd: 10,
      nowMs: world.clock.now(),
    });
    const after = await getAutoTree({ db: world.db, treeId: WORLD_TREE });
    expect(after?.phaseRev).toBe(before?.phaseRev);
  });

  it('admits a batch that was refused for budget once the cap is raised', async () => {
    const world = await makeAutoWorld({ capUsd: 0 });
    const refused = await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a' })] }),
    );
    expect(refused).toMatchObject({ kind: 'refused', code: 'budget' });
    expect(refused.kind === 'refused' ? refused.code : null).toBe('budget');
    await setAutoTreeCapIfUnchanged({
      db: world.db,
      treeId: WORLD_TREE,
      expectedCapUsd: 0,
      capUsd: 3,
      nowMs: world.clock.now(),
    });
    const retried = await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a' })] }),
    );
    expect(retried.kind).toBe('accepted');
  });

  it('admits a child with nothing left under the old cap once the cap is removed', async () => {
    const world = await makeAutoWorld({ capUsd: 0 });
    await setAutoTreeCapIfUnchanged({
      db: world.db,
      treeId: WORLD_TREE,
      expectedCapUsd: 0,
      capUsd: null,
      nowMs: world.clock.now(),
    });
    const admitted = await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a', role: 'implementer' })] }),
    );
    expect(admitted.kind).toBe('accepted');
    const reservations = await listAutoReservations({ db: world.db, treeId: WORLD_TREE });
    expect(reservations.map((row) => row.reservedUsd)).toEqual([0]);
  });
});
