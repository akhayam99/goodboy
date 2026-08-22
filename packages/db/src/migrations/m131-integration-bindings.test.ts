import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = Date.parse('2026-08-22T10:00:00.000Z');

const seedThrough130 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 130),
  );
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('container-1', 'Container', 'container', ?, ?)`,
    [NOW, NOW],
  );
  return db;
};

type SeedProjectParams = {
  readonly db: Database;
  readonly id: string;
  readonly lastAccessedAt: number | null;
};

const seedProject = async ({ db, id, lastAccessedAt }: SeedProjectParams): Promise<void> => {
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at, last_accessed_at)
     VALUES (?, 'container-1', ?, ?, 'repo', ?, ?, ?)`,
    [id, id, `/tmp/${id}`, NOW, NOW, lastAccessedAt],
  );
};

type SeedConnectionParams = {
  readonly db: Database;
  readonly id: string;
  readonly projectId: string;
  readonly provider: string;
  readonly config: string;
};

const seedConnection = async ({
  db,
  id,
  projectId,
  provider,
  config,
}: SeedConnectionParams): Promise<void> => {
  await db.execute(
    `INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
     VALUES (?, ?, ?, '', ?, ?)`,
    [id, provider, id, NOW, NOW],
  );
  await db.execute(
    `INSERT INTO workspace_integrations (id, workspace_id, provider, config, credential_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, projectId, provider, config, id, NOW, NOW],
  );
};

type BindingRow = {
  readonly id: string;
  readonly workspace_id: string;
  readonly project_id: string | null;
  readonly provider: string;
  readonly credential_id: string;
  readonly config: string;
};

const bindings = async (db: Database): Promise<ReadonlyArray<BindingRow>> =>
  db.select<BindingRow>(
    `SELECT id, workspace_id, project_id, provider, credential_id, config
     FROM integration_bindings ORDER BY id ASC`,
  );

describe('m131 integration bindings', () => {
  it('lifts the only connection of a container to a workspace-level binding', async () => {
    const db = await seedThrough130();
    await seedProject({ db, id: 'project-a', lastAccessedAt: NOW });
    await seedConnection({
      db,
      id: 'wi-linear',
      projectId: 'project-a',
      provider: 'linear',
      config: '{"workspaceUrlKey":"acme"}',
    });

    await migrate(db, migrations);

    expect(await bindings(db)).toEqual([
      {
        id: 'wi-linear',
        workspace_id: 'container-1',
        project_id: null,
        provider: 'linear',
        credential_id: 'wi-linear',
        config: '{"workspaceUrlKey":"acme"}',
      },
    ]);
  });

  it('keeps both connections when two projects of one container share a provider', async () => {
    const db = await seedThrough130();
    await seedProject({ db, id: 'project-stale', lastAccessedAt: NOW - 1000 });
    await seedProject({ db, id: 'project-fresh', lastAccessedAt: NOW });
    await seedConnection({
      db,
      id: 'wi-stale',
      projectId: 'project-stale',
      provider: 'linear',
      config: '{"workspaceUrlKey":"old"}',
    });
    await seedConnection({
      db,
      id: 'wi-fresh',
      projectId: 'project-fresh',
      provider: 'linear',
      config: '{"workspaceUrlKey":"new"}',
    });

    await migrate(db, migrations);

    expect(await bindings(db)).toEqual([
      {
        id: 'wi-fresh',
        workspace_id: 'container-1',
        project_id: null,
        provider: 'linear',
        credential_id: 'wi-fresh',
        config: '{"workspaceUrlKey":"new"}',
      },
      {
        id: 'wi-stale',
        workspace_id: 'container-1',
        project_id: 'project-stale',
        provider: 'linear',
        credential_id: 'wi-stale',
        config: '{"workspaceUrlKey":"old"}',
      },
    ]);
  });

  it('lifts a never-accessed project only when no sibling was accessed', async () => {
    const db = await seedThrough130();
    await seedProject({ db, id: 'project-accessed', lastAccessedAt: NOW });
    await seedProject({ db, id: 'project-untouched', lastAccessedAt: null });
    await seedConnection({
      db,
      id: 'wi-accessed',
      projectId: 'project-accessed',
      provider: 'sentry',
      config: '{"org":"used"}',
    });
    await seedConnection({
      db,
      id: 'wi-untouched',
      projectId: 'project-untouched',
      provider: 'sentry',
      config: '{"org":"idle"}',
    });

    await migrate(db, migrations);

    const rows = await bindings(db);
    expect(rows.find((row) => row.id === 'wi-accessed')?.project_id).toBeNull();
    expect(rows.find((row) => row.id === 'wi-untouched')?.project_id).toBe('project-untouched');
  });

  it('drops the old table and refuses a second binding on the same scope', async () => {
    const db = await seedThrough130();
    await seedProject({ db, id: 'project-a', lastAccessedAt: NOW });
    await seedConnection({
      db,
      id: 'wi-slack',
      projectId: 'project-a',
      provider: 'slack',
      config: '{}',
    });

    await migrate(db, migrations);

    const tables = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workspace_integrations'",
    );
    expect(tables).toEqual([]);
    await expect(
      db.execute(
        `INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
         VALUES ('dup', 'container-1', NULL, 'slack', 'wi-slack', '{}', ?, ?)`,
        [NOW, NOW],
      ),
    ).rejects.toThrow();
  });
});
