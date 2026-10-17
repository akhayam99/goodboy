import { describe, expect, it } from 'vitest';
import { brandId, type AutoTreeId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  AUTO_SEED_NOW,
  AUTO_SEED_ROOT,
  AUTO_SEED_SESSION,
  seedAutoSession,
  seedAutoTree,
} from '../test-helpers/auto-seeds';
import {
  casAutoTreePhase,
  claimAutoTree,
  getAutoTree,
  getAutoTreeByRootAgent,
  grantAutoTreeIfUnchanged,
  insertAutoTree,
  listAutoTreesOfSession,
  listAutoTreesToRecover,
  recordAutoRefusal,
  releaseAutoTree,
  setAutoTreeCapIfUnchanged,
} from './auto-trees';

const LEASE_MS = 10_000;
const treeId = brandId<AutoTreeId>({ value: 'tree-1' });

const world = async () => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db });
  const tree = await seedAutoTree({ db });
  return { db, tree };
};

describe('auto trees', () => {
  it('creates one tree per root agent and answers the same row to a second create', async () => {
    const { db, tree } = await world();
    expect(tree).toMatchObject({
      id: treeId,
      phase: 'answering',
      phaseRev: 0,
      generation: 1,
      stopState: 'none',
      capUsd: 5,
      isYieldRequested: false,
    });
    const again = await insertAutoTree({
      db,
      tree: {
        id: brandId<AutoTreeId>({ value: 'tree-2' }),
        rootAgentId: AUTO_SEED_ROOT,
        sessionId: AUTO_SEED_SESSION,
        primaryMountId: null,
        capUsd: 9,
        nowMs: AUTO_SEED_NOW,
        hardDeadlineAt: AUTO_SEED_NOW + 1,
      },
    });
    expect(again.isCreated).toBe(false);
    expect(again.tree.id).toBe(treeId);
    expect(await getAutoTreeByRootAgent({ db, rootAgentId: AUTO_SEED_ROOT })).toEqual(tree);
    expect(await listAutoTreesOfSession({ db, sessionId: AUTO_SEED_SESSION })).toEqual([tree]);
  });

  it('lets one scheduler own a tree at a time and hands it over when the lease runs out', async () => {
    const { db } = await world();
    const now = AUTO_SEED_NOW;
    expect(
      await claimAutoTree({ db, treeId, ownerId: 'window-a', nowMs: now, leaseMs: LEASE_MS }),
    ).toBe(true);
    expect(
      await claimAutoTree({ db, treeId, ownerId: 'window-b', nowMs: now + 1, leaseMs: LEASE_MS }),
    ).toBe(false);
    expect(
      await claimAutoTree({
        db,
        treeId,
        ownerId: 'window-a',
        nowMs: now + 5_000,
        leaseMs: LEASE_MS,
      }),
    ).toBe(true);
    expect(
      await claimAutoTree({
        db,
        treeId,
        ownerId: 'window-b',
        nowMs: now + 14_999,
        leaseMs: LEASE_MS,
      }),
    ).toBe(false);
    expect(
      await claimAutoTree({
        db,
        treeId,
        ownerId: 'window-b',
        nowMs: now + 15_000,
        leaseMs: LEASE_MS,
      }),
    ).toBe(true);
    expect(await releaseAutoTree({ db, treeId, ownerId: 'window-a' })).toBe(false);
    expect(await releaseAutoTree({ db, treeId, ownerId: 'window-b' })).toBe(true);
    const tree = await getAutoTree({ db, treeId });
    expect(tree?.schedulerOwner).toBeNull();
  });

  it('moves the phase only for the owner, on the expected revision, generation and phase', async () => {
    const { db } = await world();
    const now = AUTO_SEED_NOW;
    await claimAutoTree({ db, treeId, ownerId: 'window-a', nowMs: now, leaseMs: LEASE_MS });
    const expect0 = { phaseRev: 0, generation: 1, from: ['answering'] as const };

    const notOwner = await casAutoTreePhase({
      db,
      treeId,
      ownerId: 'window-b',
      nowMs: now,
      expect: expect0,
      to: 'deciding',
    });
    expect(notOwner).toEqual({ kind: 'lost', reason: 'not_owner' });

    const moved = await casAutoTreePhase({
      db,
      treeId,
      ownerId: 'window-a',
      nowMs: now,
      expect: expect0,
      to: 'deciding',
      patch: { activeRunId: 'run-1', isNewTurn: true },
    });
    expect(moved.kind).toBe('applied');
    expect(moved.kind === 'applied' ? moved.tree : null).toMatchObject({
      phase: 'deciding',
      phaseRev: 1,
      activeRunId: 'run-1',
      turnsUsed: 1,
    });

    const replay = await casAutoTreePhase({
      db,
      treeId,
      ownerId: 'window-a',
      nowMs: now,
      expect: expect0,
      to: 'deciding',
    });
    expect(replay).toEqual({ kind: 'lost', reason: 'stale' });
    const missing = await casAutoTreePhase({
      db,
      treeId: brandId<AutoTreeId>({ value: 'no-tree' }),
      ownerId: 'window-a',
      nowMs: now,
      expect: expect0,
      to: 'deciding',
    });
    expect(missing).toEqual({ kind: 'lost', reason: 'missing' });
  });

  it('refuses a write from an owner whose lease ran out', async () => {
    const { db } = await world();
    await claimAutoTree({
      db,
      treeId,
      ownerId: 'window-a',
      nowMs: AUTO_SEED_NOW,
      leaseMs: LEASE_MS,
    });
    const late = await casAutoTreePhase({
      db,
      treeId,
      ownerId: 'window-a',
      nowMs: AUTO_SEED_NOW + LEASE_MS,
      expect: { phaseRev: 0, generation: 1, from: ['answering'] },
      to: 'deciding',
    });
    expect(late).toEqual({ kind: 'lost', reason: 'not_owner' });
  });

  it('counts a refusal and a delegate call durably', async () => {
    const { db } = await world();
    await claimAutoTree({
      db,
      treeId,
      ownerId: 'window-a',
      nowMs: AUTO_SEED_NOW,
      leaseMs: LEASE_MS,
    });
    const refusal = { db, treeId, nowMs: AUTO_SEED_NOW, generation: 1, runId: 'run-1' };
    expect(await recordAutoRefusal({ ...refusal, ownerId: 'window-a' })).toBe(true);
    expect(await recordAutoRefusal({ ...refusal, ownerId: 'window-b', runId: 'run-2' })).toBe(
      false,
    );
    const tree = await getAutoTree({ db, treeId });
    expect(tree).toMatchObject({ refusalsUsed: 1, turnDelegateCalls: 1 });
  });

  it('counts the refusal of one run once, however often the same run asks', async () => {
    const { db } = await world();
    await claimAutoTree({
      db,
      treeId,
      ownerId: 'window-a',
      nowMs: AUTO_SEED_NOW,
      leaseMs: LEASE_MS,
    });
    const refusal = { db, treeId, ownerId: 'window-a', nowMs: AUTO_SEED_NOW };

    const first = await Promise.all([
      recordAutoRefusal({ ...refusal, generation: 1, runId: 'run-1' }),
      recordAutoRefusal({ ...refusal, generation: 1, runId: 'run-1' }),
    ]);
    const wasRepeatRecorded = await recordAutoRefusal({
      ...refusal,
      generation: 1,
      runId: 'run-1',
    });
    const wasNextRunRecorded = await recordAutoRefusal({
      ...refusal,
      generation: 1,
      runId: 'run-2',
    });
    const wasNextGenerationRecorded = await recordAutoRefusal({
      ...refusal,
      generation: 2,
      runId: 'run-2',
    });

    expect(first.filter(Boolean)).toHaveLength(1);
    expect(wasRepeatRecorded).toBe(false);
    expect(wasNextRunRecorded).toBe(true);
    expect(wasNextGenerationRecorded).toBe(true);
    expect(await getAutoTree({ db, treeId })).toMatchObject({
      refusalsUsed: 3,
      turnDelegateCalls: 3,
    });
  });

  it('changes the cap and the grants only from the value the caller saw', async () => {
    const { db } = await world();
    expect(
      await setAutoTreeCapIfUnchanged({
        db,
        treeId,
        expectedCapUsd: 5,
        capUsd: 8,
        nowMs: AUTO_SEED_NOW,
      }),
    ).toEqual({ kind: 'applied' });
    expect(
      await setAutoTreeCapIfUnchanged({
        db,
        treeId,
        expectedCapUsd: 5,
        capUsd: 9,
        nowMs: AUTO_SEED_NOW,
      }),
    ).toEqual({ kind: 'stale', capUsd: 8 });
    expect((await getAutoTree({ db, treeId }))?.capUsd).toBe(8);
    expect(
      await grantAutoTreeIfUnchanged({
        db,
        treeId,
        expectedGrants: 0,
        maxGrants: 1,
        nowMs: AUTO_SEED_NOW,
      }),
    ).toBe(true);
    expect(
      await grantAutoTreeIfUnchanged({
        db,
        treeId,
        expectedGrants: 1,
        maxGrants: 1,
        nowMs: AUTO_SEED_NOW,
      }),
    ).toBe(false);
  });

  it('lists the trees a restart has to look at', async () => {
    const { db } = await world();
    expect(await listAutoTreesToRecover({ db })).toEqual([]);
    await claimAutoTree({
      db,
      treeId,
      ownerId: 'window-a',
      nowMs: AUTO_SEED_NOW,
      leaseMs: LEASE_MS,
    });
    await casAutoTreePhase({
      db,
      treeId,
      ownerId: 'window-a',
      nowMs: AUTO_SEED_NOW,
      expect: { phaseRev: 0, generation: 1, from: ['answering'] },
      to: 'deciding',
    });
    const found = await listAutoTreesToRecover({ db });
    expect(found.map((tree) => tree.id)).toEqual([treeId]);
  });
});
