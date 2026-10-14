import { describe, expect, it } from 'vitest';
import { brandId, type AutoReservationId, type AutoTreeId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { AUTO_SEED_NOW, seedAutoSession, seedAutoTree } from '../test-helpers/auto-seeds';
import {
  getAutoReservation,
  insertAutoReservationStatement,
  listAutoReservations,
  readAutoTreeSpend,
  reconcileAutoReservationStatement,
  releaseAutoReservationStatement,
} from './auto-reservations';

const treeId = brandId<AutoTreeId>({ value: 'tree-1' });

const world = async () => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db });
  await seedAutoTree({ db, capUsd: 5 });
  return db;
};

type ReserveParams = {
  readonly db: Awaited<ReturnType<typeof world>>;
  readonly owner: string;
  readonly usd: number;
};

const reserve = async ({ db, owner, usd }: ReserveParams) => {
  const statement = insertAutoReservationStatement({
    id: brandId<AutoReservationId>({ value: `reservation-${owner}` }),
    treeId,
    ownerKind: 'attempt',
    ownerId: owner,
    reservedUsd: usd,
    nowMs: AUTO_SEED_NOW,
  });
  await db.execute(statement.sql, statement.params);
};

describe('auto reservations and spend', () => {
  it('reads settled, reserved and remaining from the one query', async () => {
    const db = await world();
    await reserve({ db, owner: 'attempt-a', usd: 1.5 });
    await reserve({ db, owner: 'attempt-b', usd: 0.5 });
    expect(await readAutoTreeSpend({ db, treeId })).toEqual({
      capUsd: 5,
      settledUsd: 0,
      reservedUsd: 2,
      remainingUsd: 3,
      estimatedUsd: 0,
    });
    expect(
      await readAutoTreeSpend({ db, treeId: brandId<AutoTreeId>({ value: 'missing' }) }),
    ).toBeNull();
  });

  it('replaces a reservation with the actual cost, and with the ceiling when the cost is unknown', async () => {
    const db = await world();
    await reserve({ db, owner: 'attempt-a', usd: 1.5 });
    await reserve({ db, owner: 'attempt-b', usd: 0.5 });
    const known = reconcileAutoReservationStatement({
      treeId,
      ownerKind: 'attempt',
      ownerId: 'attempt-a',
      costUsd: 0.25,
      nowMs: AUTO_SEED_NOW,
      abortCode: 'reconcile',
    });
    const unknown = reconcileAutoReservationStatement({
      treeId,
      ownerKind: 'attempt',
      ownerId: 'attempt-b',
      costUsd: null,
      nowMs: AUTO_SEED_NOW,
      abortCode: 'reconcile',
    });
    const outcome = await db.transaction({ statements: [known, unknown] });
    expect(outcome.status).toBe('committed');
    expect(await readAutoTreeSpend({ db, treeId })).toEqual({
      capUsd: 5,
      settledUsd: 0.75,
      reservedUsd: 0,
      remainingUsd: 4.25,
      estimatedUsd: 0.5,
    });
    const b = await getAutoReservation({
      db,
      treeId,
      ownerKind: 'attempt',
      ownerId: 'attempt-b',
    });
    expect(b).toMatchObject({ state: 'reconciled', actualUsd: 0.5, isCostKnown: false });
  });

  it('reconciles once: the second try aborts and changes nothing', async () => {
    const db = await world();
    await reserve({ db, owner: 'attempt-a', usd: 1 });
    const statement = reconcileAutoReservationStatement({
      treeId,
      ownerKind: 'attempt',
      ownerId: 'attempt-a',
      costUsd: 0.4,
      nowMs: AUTO_SEED_NOW,
      abortCode: 'reconcile',
    });
    expect((await db.transaction({ statements: [statement] })).status).toBe('committed');
    const second = await db.transaction({ statements: [statement] });
    expect(second).toEqual({ status: 'aborted', abortCode: 'reconcile', index: 0 });
    expect((await readAutoTreeSpend({ db, treeId }))?.settledUsd).toBe(0.4);
  });

  it('frees a released reservation from the remaining budget', async () => {
    const db = await world();
    await reserve({ db, owner: 'attempt-a', usd: 3 });
    const release = releaseAutoReservationStatement({
      treeId,
      ownerKind: 'attempt',
      ownerId: 'attempt-a',
      reason: 'stale_result',
      nowMs: AUTO_SEED_NOW,
    });
    await db.execute(release.sql, release.params);
    expect((await readAutoTreeSpend({ db, treeId }))?.remainingUsd).toBe(5);
    const rows = await listAutoReservations({ db, treeId });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: 'released', releasedReason: 'stale_result' });
  });
});
