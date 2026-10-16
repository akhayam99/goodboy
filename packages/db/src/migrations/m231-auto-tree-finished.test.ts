import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { listAutoTreesToRecover } from '../queries/auto-trees';
import {
  AUTO_SEED_NOW,
  seedAutoSession,
  seedAutoTree,
  seedPlanArtifact,
} from '../test-helpers/auto-seeds';
import { foreignKeyViolations, migrateThrough } from '../test-helpers/migration-rows';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { DatabaseFromNewerBuildError } from './downgradeGuard';
import { migrations } from './index';
import { m231AutoTreeFinished } from './m231-auto-tree-finished';
import { migrate } from './runner';

const CHILD_TABLES = [
  'auto_delegations',
  'auto_attempts',
  'auto_reservations',
  'auto_outbox',
  'auto_artifacts',
  'auto_artifact_versions',
] as const;

const seedChildren = async (db: Database): Promise<void> => {
  await seedPlanArtifact({ db, id: 'artifact-plan', agentId: 'agent-planner' });
  await db.execute(
    `INSERT INTO auto_delegations
       (id, tree_id, generation, request_id, request_hash, batch_id, slot, child_agent_id,
        first_attempt_id, role, request_json, target_json, routing_json, state, deadline_at, created_at)
     VALUES ('delegation-a', 'tree-1', 1, 'request-1', 'hash', 'batch-1', 0, 'agent-planner',
        'attempt-a', 'planner', '{}', '{}', '{}', 'running', ?, ?)`,
    [AUTO_SEED_NOW + 1000, AUTO_SEED_NOW],
  );
  await db.execute(
    `INSERT INTO auto_attempts (id, delegation_id, tree_id, generation, ordinal, state, started_at)
     VALUES ('attempt-a', 'delegation-a', 'tree-1', 1, 1, 'running', ?)`,
    [AUTO_SEED_NOW],
  );
  await db.execute(
    `INSERT INTO auto_reservations
       (id, tree_id, owner_kind, owner_id, reserved_usd, created_at, updated_at)
     VALUES ('reservation-a', 'tree-1', 'attempt', 'attempt-a', 0.75, ?, ?)`,
    [AUTO_SEED_NOW, AUTO_SEED_NOW],
  );
  for (const id of ['outbox-1', 'outbox-2']) {
    await db.execute(
      `INSERT INTO auto_outbox (id, tree_id, generation, kind, join_key, payload_json, created_at)
       VALUES (?, 'tree-1', 1, 'user', ?, '{"kind":"user","text":"ship ledger-core"}', ?)`,
      [id, `user:${id}`, AUTO_SEED_NOW],
    );
  }
  await db.execute(
    `INSERT INTO auto_artifacts
       (artifact_id, tree_id, kind, owner_agent_id, owner_delegation_id, owner_role, rev, created_at)
     VALUES ('artifact-plan', 'tree-1', 'plan', 'agent-planner', 'delegation-a', 'planner', 1, ?)`,
    [AUTO_SEED_NOW],
  );
  await db.execute(
    `INSERT INTO auto_artifact_versions
       (artifact_id, revision, delegation_id, attempt_id, content_hash, created_at)
     VALUES ('artifact-plan', 1, 'delegation-a', 'attempt-a', 'hash-1', ?)`,
    [AUTO_SEED_NOW],
  );
};

const childCounts = async (db: Database): Promise<Readonly<Record<string, number>>> => {
  const entries = await Promise.all(
    CHILD_TABLES.map(async (table) => {
      const rows = await db.select<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
      return [table, rows[0]?.count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
};

const seedAt230 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 230 });
  await seedAutoSession({ db, agentIds: ['agent-planner'] });
  await seedAutoTree({ db, capUsd: 5 });
  await seedChildren(db);
  return db;
};

const indexSql = async (db: Database): Promise<ReadonlyArray<string>> => {
  const rows = await db.select<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'auto_trees' AND sql IS NOT NULL ORDER BY name",
  );
  return rows.map((row) => row.sql);
};

describe('m231 auto tree finished', () => {
  it('keeps the tree and every child row through the rebuild', async () => {
    const db = await seedAt230();
    const before = await childCounts(db);
    const result = await migrateThrough({ db, version: 231 });
    expect(result.applied).toEqual([231]);
    expect(before).toEqual({
      auto_delegations: 1,
      auto_attempts: 1,
      auto_reservations: 1,
      auto_outbox: 2,
      auto_artifacts: 1,
      auto_artifact_versions: 1,
    });
    expect(await childCounts(db)).toEqual(before);
    expect(
      await db.select<{ id: string; cap_usd: number; phase: string }>(
        'SELECT id, cap_usd, phase FROM auto_trees',
      ),
    ).toEqual([{ id: 'tree-1', cap_usd: 5, phase: 'answering' }]);
    expect(await foreignKeyViolations(db)).toEqual([]);
  });

  it('accepts a finished phase and a missing cap, and still refuses an unknown phase', async () => {
    const db = await seedAt230();
    await migrateThrough({ db, version: 231 });
    await db.execute(
      "UPDATE auto_trees SET phase = 'finished', cap_usd = NULL WHERE id = 'tree-1'",
    );
    expect(
      await db.select<{ phase: string; cap_usd: number | null }>(
        'SELECT phase, cap_usd FROM auto_trees',
      ),
    ).toEqual([{ phase: 'finished', cap_usd: null }]);
    await expect(
      db.execute("UPDATE auto_trees SET phase = 'closed' WHERE id = 'tree-1'"),
    ).rejects.toThrow();
    await expect(
      db.execute("UPDATE auto_trees SET cap_usd = -1 WHERE id = 'tree-1'"),
    ).rejects.toThrow();
  });

  it('recreates both indexes and leaves a finished tree out of the live index', async () => {
    const db = await seedAt230();
    await migrateThrough({ db, version: 231 });
    expect(await indexSql(db)).toEqual([
      "CREATE INDEX idx_auto_trees_live ON auto_trees(phase) WHERE phase NOT IN ('done', 'finished', 'stopped')",
      'CREATE INDEX idx_auto_trees_session ON auto_trees(session_id)',
    ]);
  });

  it('does not recover a finished tree after a restart', async () => {
    const db = await seedAt230();
    await migrateThrough({ db, version: 231 });
    await db.execute("UPDATE auto_trees SET phase = 'merging' WHERE id = 'tree-1'");
    expect((await listAutoTreesToRecover({ db })).map((tree) => tree.id)).toEqual(['tree-1']);
    await db.execute("UPDATE auto_trees SET phase = 'finished' WHERE id = 'tree-1'");
    expect(await listAutoTreesToRecover({ db })).toEqual([]);
  });

  it('runs again over a half run without losing a row', async () => {
    const db = await seedAt230();
    await migrateThrough({ db, version: 231 });
    const before = await childCounts(db);
    await db.exec(m231AutoTreeFinished);
    expect(await childCounts(db)).toEqual(before);
    expect(await db.select('SELECT id FROM auto_trees')).toEqual([{ id: 'tree-1' }]);
    expect(await foreignKeyViolations(db)).toEqual([]);
  });

  it('applies in one segment and leaves no checkpoint behind', async () => {
    const db = await seedAt230();
    await migrateThrough({ db, version: 231 });
    expect(
      await db.select('SELECT segment FROM schema_migration_segment WHERE version = 231'),
    ).toEqual([]);
  });

  it('makes an older build refuse the upgraded file instead of reading it', async () => {
    const db = await makeMigratedTestDatabase();
    const olderBuild = migrations.filter((migration) => migration.version <= 230);
    const failure = await migrate(db, olderBuild).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DatabaseFromNewerBuildError);
    expect(failure).toMatchObject({
      unknownVersions: expect.arrayContaining([231]),
      highestKnownVersion: 230,
    });
  });
});
