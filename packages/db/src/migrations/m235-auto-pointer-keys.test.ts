import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { AUTO_SEED_NOW, seedAutoSession, seedAutoTree } from '../test-helpers/auto-seeds';
import { foreignKeyViolations, migrateThrough } from '../test-helpers/migration-rows';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';

const BEFORE_M235 = 234;

type DelegationParams = {
  readonly db: Database;
  readonly id: string;
  readonly retryOf: string | null;
};

const insertDelegation = async ({ db, id, retryOf }: DelegationParams): Promise<void> => {
  await db.execute(
    `INSERT INTO auto_delegations
      (id, tree_id, generation, request_id, request_hash, batch_id, slot, child_agent_id,
       first_attempt_id, role, request_json, target_json, routing_json, retry_of, deadline_at, created_at)
     VALUES (?, 'tree-1', 1, ?, 'hash', 'batch-1', 0, ?, ?, 'implementer', '{}', '{}', '{}', ?, ?, ?)`,
    [id, `request-${id}`, `agent-${id}`, `attempt-${id}`, retryOf, AUTO_SEED_NOW, AUTO_SEED_NOW],
  );
};

const seedBeforeM235 = async ({ db }: { readonly db: Database }): Promise<void> => {
  await seedAutoSession({ db });
  await seedAutoTree({ db, id: 'tree-1', primaryMountId: 'mount-ledger-core' });
  await insertDelegation({ db, id: 'first', retryOf: null });
  await insertDelegation({ db, id: 'second', retryOf: 'first' });
  await insertDelegation({ db, id: 'dangling', retryOf: 'deleted-long-ago' });
};

const column = async ({
  db,
  sql,
}: {
  readonly db: Database;
  readonly sql: string;
}): Promise<ReadonlyArray<string | null>> =>
  (await db.select<{ value: string | null }>(sql)).map((row) => row.value);

describe('m235 auto pointer keys', () => {
  it('keeps every row, keeps live pointers and clears a pointer that names nothing', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: BEFORE_M235 });
    await seedBeforeM235({ db });
    await db.execute("UPDATE auto_trees SET primary_mount_id = 'mount-gone' WHERE id = 'tree-1'");
    const trees = await column({ db, sql: 'SELECT COUNT(*) AS value FROM auto_trees' });

    await migrateThrough({ db, version: 235 });

    expect(await column({ db, sql: 'SELECT COUNT(*) AS value FROM auto_trees' })).toEqual(trees);
    expect(await column({ db, sql: 'SELECT COUNT(*) AS value FROM auto_delegations' })).toEqual([
      3,
    ]);
    expect(await column({ db, sql: 'SELECT primary_mount_id AS value FROM auto_trees' })).toEqual([
      null,
    ]);
    expect(
      await column({ db, sql: 'SELECT retry_of AS value FROM auto_delegations ORDER BY id' }),
    ).toEqual([null, null, 'first']);
    expect(await foreignKeyViolations(db)).toEqual([]);
  });

  it('keeps a mount pointer that names a live mount', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: BEFORE_M235 });
    await seedBeforeM235({ db });

    await migrateThrough({ db, version: 235 });

    expect(await column({ db, sql: 'SELECT primary_mount_id AS value FROM auto_trees' })).toEqual([
      'mount-ledger-core',
    ]);
  });

  it('clears the pointer when the mount goes, and keeps the tree', async () => {
    const db = await makeMigratedTestDatabase();
    await seedAutoSession({ db });
    await seedAutoTree({ db });

    await db.execute("DELETE FROM session_worktrees WHERE id = 'mount-ledger-core'");

    expect(await column({ db, sql: 'SELECT primary_mount_id AS value FROM auto_trees' })).toEqual([
      null,
    ]);
    expect(await column({ db, sql: 'SELECT id AS value FROM auto_trees' })).toEqual(['tree-1']);
  });

  it('clears retry_of when the delegation it points at goes, and keeps the retry', async () => {
    const db = await makeMigratedTestDatabase();
    await seedAutoSession({ db });
    await seedAutoTree({ db });
    await insertDelegation({ db, id: 'first', retryOf: null });
    await insertDelegation({ db, id: 'second', retryOf: 'first' });

    await db.execute("DELETE FROM auto_delegations WHERE id = 'first'");

    expect(await column({ db, sql: 'SELECT id AS value FROM auto_delegations' })).toEqual([
      'second',
    ]);
    expect(await column({ db, sql: 'SELECT retry_of AS value FROM auto_delegations' })).toEqual([
      null,
    ]);
  });

  it('refuses a new tree that points at a mount that does not exist', async () => {
    const db = await makeMigratedTestDatabase();
    await seedAutoSession({ db });

    await expect(seedAutoTree({ db, primaryMountId: 'mount-never-created' })).rejects.toThrow();
  });

  it('keeps the indexes of both rebuilt tables', async () => {
    const db = await makeMigratedTestDatabase();
    const names = await column({
      db,
      sql: `SELECT name AS value FROM sqlite_master
            WHERE type = 'index' AND tbl_name IN ('auto_trees', 'auto_delegations')
              AND sql IS NOT NULL ORDER BY name`,
    });

    expect(names).toEqual([
      'idx_auto_delegations_batch',
      'idx_auto_delegations_child',
      'idx_auto_delegations_open_child',
      'idx_auto_delegations_tree',
      'idx_auto_trees_live',
      'idx_auto_trees_session',
    ]);
  });
});
