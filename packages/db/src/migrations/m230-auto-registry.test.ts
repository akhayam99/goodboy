import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { foreignKeyViolations, migrateThrough } from '../test-helpers/migration-rows';
import { DatabaseFromNewerBuildError } from './downgradeGuard';
import { migrations } from './index';
import { m230AutoRegistry } from './m230-auto-registry';
import { migrate } from './runner';

const TABLES = [
  'auto_trees',
  'auto_delegations',
  'auto_attempts',
  'auto_reservations',
  'auto_outbox',
  'auto_artifacts',
  'auto_artifact_versions',
] as const;

const autoTables = async (db: Database): Promise<ReadonlyArray<string>> => {
  const rows = await db.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'auto_%' ORDER BY name",
  );
  return rows.map((row) => row.name);
};

const otherTables = async (db: Database): Promise<ReadonlyArray<string>> => {
  const rows = await db.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'auto_%' ORDER BY name",
  );
  return rows.map((row) => row.name);
};

const columnsOf = async ({
  db,
  table,
}: {
  readonly db: Database;
  readonly table: string;
}): Promise<ReadonlyArray<string>> => {
  const rows = await db.select<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.map((row) => row.name);
};

describe('m230 auto registry', () => {
  it('creates the seven tables on an existing database and touches nothing else', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 229 });
    const before = await otherTables(db);
    expect(await autoTables(db)).toEqual([]);
    const result = await migrateThrough({ db, version: 230 });
    expect(result.applied).toEqual([230]);
    expect(await autoTables(db)).toEqual([...TABLES].sort());
    expect(await otherTables(db)).toEqual(before);
    expect(await foreignKeyViolations(db)).toEqual([]);
  });

  it('carries the adopted column and the counters later slices need', async () => {
    const db = await makeMigratedTestDatabase();
    expect(await columnsOf({ db, table: 'auto_delegations' })).toEqual(
      expect.arrayContaining(['adopted', 'retry_of', 'revise_of', 'base_revision', 'deadline_at']),
    );
    expect(await columnsOf({ db, table: 'auto_trees' })).toEqual(
      expect.arrayContaining([
        'phase_rev',
        'generation',
        'stop_state',
        'cap_usd',
        'turns_used',
        'delegations_used',
        'attempts_used',
        'refusals_used',
        'no_progress_streak',
        'question_cycles',
        'grants',
        'hard_deadline_at',
        'scheduler_owner',
        'owner_lease_expires_at',
      ]),
    );
  });

  it('indexes the Auto root agents so the scan for agents without a tree does not read every agent', async () => {
    const db = await makeMigratedTestDatabase();
    const plan = await db.select<{ detail: string }>(
      `EXPLAIN QUERY PLAN SELECT a.id FROM live_agents a
       WHERE a.kind = 'auto' AND a.parent_agent_id IS NULL ORDER BY a.session_id, a.ordinal`,
    );
    expect(plan.map((row) => row.detail).join(' ')).toContain('idx_agents_auto_roots');
  });

  it('is idempotent: running its sql again changes nothing', async () => {
    const db = await makeMigratedTestDatabase();
    const read = () =>
      db.select<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE name LIKE '%auto_%' ORDER BY name",
      );
    const before = await read();
    await db.exec(m230AutoRegistry);
    expect(await read()).toEqual(before);
  });

  it('is additive: an older build refuses the upgraded file instead of reading it', async () => {
    const db = await makeMigratedTestDatabase();
    const olderBuild = migrations.filter((migration) => migration.version <= 229);
    const failure = await migrate(db, olderBuild).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DatabaseFromNewerBuildError);
    expect(failure).toMatchObject({ unknownVersions: [230], highestKnownVersion: 229 });
    expect(await autoTables(db)).toEqual([...TABLES].sort());
  });
});
