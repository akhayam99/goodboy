import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { foreignKeyViolations, migrateThrough } from '../test-helpers/migration-rows';
import { AUTO_SEED_NOW, seedAutoSession, seedAutoTree } from '../test-helpers/auto-seeds';
import { DatabaseFromNewerBuildError } from './downgradeGuard';
import { migrations } from './index';
import { migrate } from './runner';

const CHILD_TABLES = [
  'auto_delegations',
  'auto_attempts',
  'auto_reservations',
  'auto_outbox',
  'auto_artifacts',
] as const;

const BEFORE_M232 = 230;

const insertDelegation = async ({
  db,
  id,
  role,
}: {
  readonly db: Database;
  readonly id: string;
  readonly role: string;
}): Promise<void> => {
  await db.execute(
    `INSERT INTO auto_delegations
      (id, tree_id, generation, request_id, request_hash, batch_id, slot, child_agent_id,
       first_attempt_id, role, request_json, target_json, routing_json, deadline_at, created_at)
     VALUES (?, 'tree-1', 1, ?, 'hash', 'batch-1', 0, ?, ?, ?, '{}', '{}', '{}', ?, ?)`,
    [id, `request-${id}`, `agent-${id}`, `attempt-${id}`, role, AUTO_SEED_NOW, AUTO_SEED_NOW],
  );
};

const seedTreeWithChildren = async ({ db }: { readonly db: Database }): Promise<void> => {
  await seedAutoSession({ db });
  await seedAutoTree({ db });
  await insertDelegation({ db, id: 'implementer-1', role: 'implementer' });
  await db.execute(
    `INSERT INTO auto_attempts (id, delegation_id, tree_id, generation, ordinal, started_at)
     VALUES ('attempt-implementer-1', 'implementer-1', 'tree-1', 1, 1, ?)`,
    [AUTO_SEED_NOW],
  );
  await db.execute(
    `INSERT INTO auto_reservations
      (id, tree_id, owner_kind, owner_id, reserved_usd, state, created_at, updated_at)
     VALUES ('reservation-1', 'tree-1', 'attempt', 'attempt-implementer-1', 3, 'reserved', ?, ?)`,
    [AUTO_SEED_NOW, AUTO_SEED_NOW],
  );
  await db.execute(
    `INSERT INTO auto_outbox (id, tree_id, generation, kind, join_key, payload_json, created_at)
     VALUES ('outbox-1', 'tree-1', 1, 'user', 'user:outbox-1', '{"kind":"user"}', ?)`,
    [AUTO_SEED_NOW],
  );
};

const childCounts = async ({ db }: { readonly db: Database }) =>
  Object.fromEntries(
    await Promise.all(
      CHILD_TABLES.map(async (table) => {
        const rows = await db.select<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
        return [table, rows[0]?.count ?? 0] as const;
      }),
    ),
  );

const indexesOf = async ({ db }: { readonly db: Database }) =>
  (
    await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'auto_delegations' AND sql IS NOT NULL ORDER BY name",
    )
  ).map((row) => row.name);

describe('m232 auto delegation roles', () => {
  it('rebuilds auto_delegations without losing a row of it or of the tables that hang on it', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: BEFORE_M232 });
    await seedTreeWithChildren({ db });
    const before = await childCounts({ db });
    const indexes = await indexesOf({ db });

    await migrateThrough({ db, version: 232 });

    expect(await childCounts({ db })).toEqual(before);
    expect(before['auto_attempts']).toBe(1);
    expect(await indexesOf({ db })).toEqual(indexes);
    expect(await foreignKeyViolations(db)).toEqual([]);
    const rows = await db.select<{ role: string }>('SELECT role FROM auto_delegations');
    expect(rows).toEqual([{ role: 'implementer' }]);
  });

  it('accepts Scribe, CI fixer and Rewriter delegations and still refuses a role outside the list', async () => {
    const db = await makeMigratedTestDatabase();
    await seedAutoSession({ db });
    await seedAutoTree({ db });

    for (const role of ['scribe', 'ci-fixer', 'rewriter']) {
      await insertDelegation({ db, id: `${role}-1`, role });
    }
    await expect(insertDelegation({ db, id: 'resolver-1', role: 'resolver' })).rejects.toThrow();
    await expect(insertDelegation({ db, id: 'ci-1', role: 'ci_fixer' })).rejects.toThrow();
  });

  it('keeps the cascade from the tree after the rebuild', async () => {
    const db = await makeMigratedTestDatabase();
    await seedTreeWithChildren({ db });

    await db.execute("DELETE FROM auto_trees WHERE id = 'tree-1'", []);

    expect(await childCounts({ db })).toEqual({
      auto_delegations: 0,
      auto_attempts: 0,
      auto_reservations: 0,
      auto_outbox: 0,
      auto_artifacts: 0,
    });
  });

  it('is refused by an older build instead of being read with a narrower check', async () => {
    const db = await makeMigratedTestDatabase();
    const olderBuild = migrations.filter((migration) => migration.version < 232);
    const failure = await migrate(db, olderBuild).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DatabaseFromNewerBuildError);
  });
});
