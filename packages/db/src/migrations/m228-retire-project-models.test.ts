import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { migrations } from './index';
import { migrate } from './runner';
import { migrateThrough } from '../test-helpers/migration-rows';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { getSetting, listSettingsWithPrefix } from '../queries/settings';

const TASKS = '{"summarizer":{"providerId":"anthropic","model":"claude-sonnet-5"}}';
const ROLES = '{"reviewer":{"providerId":"codex","model":"gpt-6.1-sol","effort":"high"}}';

type ProjectSeed = {
  readonly db: Database;
  readonly id: string;
  readonly name: string;
  readonly tasks: string | null;
  readonly roles: string | null;
};

const insertProject = async ({ db, id, name, tasks, roles }: ProjectSeed) => {
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at, task_models, role_models, provider_pool)
     VALUES (?, 'workspace-harborline', ?, ?, 'repo', 1, 2, ?, ?, '[{"id":"codex","state":"on"}]')`,
    [id, name, `/fixture/${name}`, tasks, roles],
  );
};

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 227 });
  await db.execute('PRAGMA foreign_keys = OFF');
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace-harborline', 'Harborline', 'harborline', 1, 1)",
  );
  await insertProject({ db, id: 'both', name: 'ledger-core', tasks: TASKS, roles: ROLES });
  await insertProject({ db, id: 'tasks-only', name: 'notify-relay', tasks: TASKS, roles: null });
  await insertProject({ db, id: 'none', name: 'payments-api', tasks: null, roles: null });
  await insertProject({ db, id: 'broken', name: 'northwind', tasks: '{not json', roles: ROLES });
  const result = await migrateThrough({ db, version: 228 });
  expect(result.applied).toEqual([228]);
  return db;
};

const backupOf = async ({ db, id }: { readonly db: Database; readonly id: string }) => {
  const raw = await getSetting(db, `legacy.projectModels.${id}`);
  return raw === null ? null : JSON.parse(raw);
};

describe('m228 retire project models', () => {
  it('saves the task and role models of a project that had both', async () => {
    const db = await seed();
    expect(await backupOf({ db, id: 'both' })).toEqual({
      taskModels: JSON.parse(TASKS),
      roleModels: JSON.parse(ROLES),
    });
  });

  it('saves a project that had only one of the two', async () => {
    const db = await seed();
    expect(await backupOf({ db, id: 'tasks-only' })).toEqual({
      taskModels: JSON.parse(TASKS),
      roleModels: null,
    });
  });

  it('saves nothing for a project with neither', async () => {
    const db = await seed();
    expect(await backupOf({ db, id: 'none' })).toBeNull();
  });

  it('keeps the readable half of a project whose other half is not json', async () => {
    const db = await seed();
    expect(await backupOf({ db, id: 'broken' })).toEqual({
      taskModels: null,
      roleModels: JSON.parse(ROLES),
    });
  });

  it('writes one key per project with models and no other key', async () => {
    const db = await seed();
    const keys = (await listSettingsWithPrefix(db, 'legacy.projectModels.')).map(
      (entry) => entry.key,
    );
    expect(keys).toEqual([
      'legacy.projectModels.both',
      'legacy.projectModels.broken',
      'legacy.projectModels.tasks-only',
    ]);
  });

  it('clears both columns on every project and keeps the rest of the row', async () => {
    const db = await seed();
    const rows = await db.select<{
      readonly id: string;
      readonly task_models: string | null;
      readonly role_models: string | null;
      readonly provider_pool: string | null;
    }>('SELECT id, task_models, role_models, provider_pool FROM projects ORDER BY id');
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.task_models === null && row.role_models === null)).toBe(true);
    expect(rows.every((row) => row.provider_pool === '[{"id":"codex","state":"on"}]')).toBe(true);
  });

  it('does nothing on a second run and keeps the saved values', async () => {
    const db = await seed();
    const before = await listSettingsWithPrefix(db, 'legacy.projectModels.');
    await db.exec(migrations.find((migration) => migration.version === 228)?.sql ?? '');
    expect(await listSettingsWithPrefix(db, 'legacy.projectModels.')).toEqual(before);
    const again = await migrate(
      db,
      migrations.filter((migration) => migration.version <= 228),
    );
    expect(again.applied).toEqual([]);
  });
});
