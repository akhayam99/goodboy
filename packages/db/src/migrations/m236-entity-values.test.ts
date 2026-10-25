import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrateThrough } from '../test-helpers/migration-rows';
import type { Database } from '../client';

type ValueRow = {
  readonly key: string;
  readonly value: string;
  readonly updated_at: number;
};

type SettingRow = {
  readonly key: string;
};

const seedOldShape = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 234 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('harborline', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at) VALUES ('ledger-core', 'harborline', 'ledger-core', '/repo/ledger-core', 'folder', 1, 1)",
  );
  const old: ReadonlyArray<readonly [string, string, number]> = [
    ['auto.treeLimitUsd.harborline', '12.5', 11],
    ['terminal.workspaceFolder.harborline', '/repo/ledger-core/docs', 12],
    ['sessions.pinned.harborline', '[{"id":"s1","at":5}]', 13],
    ['folder.purpose.ledger-core', 'documents', 14],
    ['folder.git.ledger-core', 'in-place', 15],
    ['auto.treeLimitUsd.northwind', '3', 16],
    ['sessions.pinned.northwind', '[]', 17],
    ['folder.purpose.payments-api', 'code', 18],
    ['folder.git.payments-api', 'in-place', 19],
    ['terminal.workspaceFolder.northwind', '', 20],
    ['editor.binary', 'code', 21],
    ['bootstrap.phase.ledger-core', '{"step":"scan"}', 22],
  ];
  for (const [key, value, updatedAt] of old) {
    await db.execute('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [
      key,
      value,
      updatedAt,
    ]);
  }
  return db;
};

const migrated = async (): Promise<Database> => {
  const db = await seedOldShape();
  const result = await migrateThrough({ db, version: 236 });
  expect(result.applied.at(-1)).toBe(236);
  return db;
};

describe('m236 entity values', () => {
  it('boots from the old shape and moves each workspace value under its workspace', async () => {
    const db = await migrated();

    const rows = await db.select<ValueRow>(
      "SELECT key, value, updated_at FROM workspace_values WHERE workspace_id = 'harborline' ORDER BY key",
    );

    expect(rows).toEqual([
      { key: 'auto.treeLimitUsd', value: '12.5', updated_at: 11 },
      { key: 'sessions.pinned', value: '[{"id":"s1","at":5}]', updated_at: 13 },
      { key: 'terminal.workspaceFolder', value: '/repo/ledger-core/docs', updated_at: 12 },
    ]);
  });

  it('moves each project value under its project', async () => {
    const db = await migrated();

    const rows = await db.select<ValueRow>(
      "SELECT key, value, updated_at FROM project_values WHERE project_id = 'ledger-core' ORDER BY key",
    );

    expect(rows).toEqual([
      { key: 'folder.git', value: 'in-place', updated_at: 15 },
      { key: 'folder.purpose', value: 'documents', updated_at: 14 },
    ]);
  });

  it('drops the rows of an entity that no longer exists instead of moving them', async () => {
    const db = await migrated();

    const workspaceRows = await db.select<{ readonly count: number }>(
      "SELECT COUNT(*) AS count FROM workspace_values WHERE workspace_id <> 'harborline'",
    );
    const projectRows = await db.select<{ readonly count: number }>(
      "SELECT COUNT(*) AS count FROM project_values WHERE project_id <> 'ledger-core'",
    );

    expect(workspaceRows[0]?.count).toBe(0);
    expect(projectRows[0]?.count).toBe(0);
  });

  it('leaves no per entity row in settings and keeps the true globals', async () => {
    const db = await migrated();

    const rows = await db.select<SettingRow>('SELECT key FROM settings ORDER BY key');

    expect(rows.map((row) => row.key)).toEqual(['bootstrap.phase.ledger-core', 'editor.binary']);
  });

  it('removes a deleted workspace and its folders with every value they held', async () => {
    const db = await migrated();

    await db.execute("DELETE FROM workspaces WHERE id = 'harborline'");

    const workspaceRows = await db.select<{ readonly count: number }>(
      'SELECT COUNT(*) AS count FROM workspace_values',
    );
    const projectRows = await db.select<{ readonly count: number }>(
      'SELECT COUNT(*) AS count FROM project_values',
    );
    expect(workspaceRows[0]?.count).toBe(0);
    expect(projectRows[0]?.count).toBe(0);
  });

  it('removes the values of one deleted folder and keeps the workspace values', async () => {
    const db = await migrated();

    await db.execute("DELETE FROM projects WHERE id = 'ledger-core'");

    const projectRows = await db.select<{ readonly count: number }>(
      'SELECT COUNT(*) AS count FROM project_values',
    );
    const workspaceRows = await db.select<{ readonly count: number }>(
      'SELECT COUNT(*) AS count FROM workspace_values',
    );
    expect(projectRows[0]?.count).toBe(0);
    expect(workspaceRows[0]?.count).toBe(3);
  });
});
