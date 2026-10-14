import { describe, expect, it } from 'vitest';
import { brandId, type AutoOutboxId, type AutoTreeId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { AUTO_SEED_NOW, seedAutoSession, seedAutoTree } from '../test-helpers/auto-seeds';
import {
  acceptAutoOutboxStatement,
  claimAutoOutbox,
  dropAutoOutboxOfOldGenerationsStatement,
  getAutoOutbox,
  insertAutoOutbox,
  listAutoOutbox,
  releaseAutoOutboxClaim,
} from './auto-outbox';

const treeId = brandId<AutoTreeId>({ value: 'tree-1' });

const world = async () => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db });
  await seedAutoTree({ db });
  return db;
};

type RowParams = {
  readonly id: string;
  readonly joinKey: string;
  readonly generation?: number;
  readonly kind?: 'results' | 'question' | 'user';
};

const row = ({ id, joinKey, generation = 1, kind = 'results' }: RowParams) => ({
  id: brandId<AutoOutboxId>({ value: id }),
  treeId,
  generation,
  kind,
  joinKey,
  payload: { text: `payload ${id}` },
  nowMs: AUTO_SEED_NOW,
});

describe('auto outbox', () => {
  it('keeps one row per join key, however many times the join fires', async () => {
    const db = await world();
    const first = await insertAutoOutbox({
      db,
      outbox: row({ id: 'outbox-1', joinKey: 'join-a' }),
    });
    const second = await insertAutoOutbox({
      db,
      outbox: row({ id: 'outbox-2', joinKey: 'join-a' }),
    });
    expect(first.isCreated).toBe(true);
    expect(second.isCreated).toBe(false);
    expect(second.row.id).toBe('outbox-1');
    expect(await listAutoOutbox({ db, treeId })).toHaveLength(1);
  });

  it('lets one worker claim a pending row, and releases it for the next try', async () => {
    const db = await world();
    await insertAutoOutbox({ db, outbox: row({ id: 'outbox-1', joinKey: 'join-a' }) });
    const claim = {
      db,
      outboxId: brandId<AutoOutboxId>({ value: 'outbox-1' }),
      generation: 1,
      nowMs: AUTO_SEED_NOW,
      claimMs: 5_000,
    };
    expect(await claimAutoOutbox({ ...claim, claimedBy: 'window-a' })).toBe(true);
    expect(await claimAutoOutbox({ ...claim, claimedBy: 'window-b' })).toBe(false);
    expect(
      await releaseAutoOutboxClaim({ db, outboxId: claim.outboxId, claimedBy: 'window-b' }),
    ).toBe(false);
    expect(
      await releaseAutoOutboxClaim({ db, outboxId: claim.outboxId, claimedBy: 'window-a' }),
    ).toBe(true);
    expect(await claimAutoOutbox({ ...claim, claimedBy: 'window-b' })).toBe(true);
    const stored = await getAutoOutbox({ db, outboxId: claim.outboxId });
    expect(stored).toMatchObject({
      state: 'claimed',
      claimedBy: 'window-b',
      claimExpiresAt: AUTO_SEED_NOW + 5_000,
    });
  });

  it('accepts only for the claimer, once', async () => {
    const db = await world();
    await insertAutoOutbox({ db, outbox: row({ id: 'outbox-1', joinKey: 'join-a' }) });
    await claimAutoOutbox({
      db,
      outboxId: brandId<AutoOutboxId>({ value: 'outbox-1' }),
      generation: 1,
      claimedBy: 'window-a',
      nowMs: AUTO_SEED_NOW,
      claimMs: 5_000,
    });
    const wrong = acceptAutoOutboxStatement({
      outboxId: brandId<AutoOutboxId>({ value: 'outbox-1' }),
      claimedBy: 'window-b',
      runId: 'run-9',
      abortCode: 'accept',
    });
    expect((await db.transaction({ statements: [wrong] })).status).toBe('aborted');
    const right = acceptAutoOutboxStatement({
      outboxId: brandId<AutoOutboxId>({ value: 'outbox-1' }),
      claimedBy: 'window-a',
      runId: 'run-9',
      abortCode: 'accept',
    });
    expect((await db.transaction({ statements: [right] })).status).toBe('committed');
    expect((await db.transaction({ statements: [right] })).status).toBe('aborted');
    expect(
      await getAutoOutbox({ db, outboxId: brandId<AutoOutboxId>({ value: 'outbox-1' }) }),
    ).toMatchObject({
      state: 'accepted',
      acceptedRunId: 'run-9',
    });
  });

  it('drops what an older generation left unprocessed and keeps what was accepted', async () => {
    const db = await world();
    await insertAutoOutbox({ db, outbox: row({ id: 'outbox-old', joinKey: 'join-old' }) });
    await insertAutoOutbox({
      db,
      outbox: row({ id: 'outbox-new', joinKey: 'join-new', generation: 2, kind: 'user' }),
    });
    const drop = dropAutoOutboxOfOldGenerationsStatement({
      treeId,
      currentGeneration: 2,
      reason: 'generation_changed',
    });
    await db.execute(drop.sql, drop.params);
    const rows = await listAutoOutbox({ db, treeId });
    expect(rows.map((item) => [item.id, item.state, item.droppedReason])).toEqual([
      ['outbox-old', 'dropped', 'generation_changed'],
      ['outbox-new', 'pending', null],
    ]);
    expect(
      (await listAutoOutbox({ db, treeId, states: ['pending'] })).map((item) => item.id),
    ).toEqual(['outbox-new']);
  });
});
