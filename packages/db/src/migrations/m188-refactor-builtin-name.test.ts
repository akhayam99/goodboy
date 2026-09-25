import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { m188RefactorBuiltinName } from './m188-refactor-builtin-name';
import { migrate } from './runner';

const NOW = Date.parse('2026-09-25T12:00:00.000Z');

type WorkflowSeed = {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly isPreset?: number;
};

const insertWorkflow = async (db: Database, seed: WorkflowSeed): Promise<void> => {
  await db.execute(
    `INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at, is_preset)
     VALUES (?, ?, ?, '', ?, ?, ?)`,
    [seed.id, seed.workspaceId, seed.name, NOW, NOW, seed.isPreset ?? 1],
  );
};

const seedThrough181 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 181 });
  for (const [id, name] of [
    ['ws-harborline', 'Harborline'],
    ['ws-northwind', 'Northwind'],
    ['ws-acme', 'Acme'],
  ] as const) {
    await db.execute(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [id, name, name.toLowerCase(), NOW, NOW],
    );
  }
  await insertWorkflow(db, {
    id: 'wf_seed_refactor-example_ws-harborline',
    workspaceId: 'ws-harborline',
    name: 'Refactor (example)',
  });
  await insertWorkflow(db, {
    id: 'wf_seed_refactor-example_ws-northwind',
    workspaceId: 'ws-northwind',
    name: 'Refactor ledger-core',
  });
  await insertWorkflow(db, {
    id: 'wf_seed_refactor-example_ws-acme',
    workspaceId: 'ws-acme',
    name: 'Refactor (example)',
  });
  await insertWorkflow(db, { id: 'wf-acme-own', workspaceId: 'ws-acme', name: 'Refactor' });
  await insertWorkflow(db, {
    id: 'wf-harborline-own',
    workspaceId: 'ws-harborline',
    name: 'Refactor (example)',
    isPreset: 0,
  });
  return db;
};

type NameRow = {
  readonly id: string;
  readonly name: string;
};

const names = async (db: Database): Promise<ReadonlyArray<NameRow>> =>
  db.select<NameRow>('SELECT id, name FROM workflows ORDER BY id ASC');

describe('m188 refactor built-in name', () => {
  it('renames the built-in refactor only where the user left its seed name', async () => {
    const db = await seedThrough181();

    await migrate(db, migrations);

    expect(await names(db)).toEqual([
      { id: 'wf-acme-own', name: 'Refactor' },
      { id: 'wf-harborline-own', name: 'Refactor (example)' },
      { id: 'wf_seed_refactor-example_ws-acme', name: 'Refactor (example)' },
      { id: 'wf_seed_refactor-example_ws-harborline', name: 'Refactor' },
      { id: 'wf_seed_refactor-example_ws-northwind', name: 'Refactor ledger-core' },
    ]);
  });

  it('runs again after a crash without changing the result', async () => {
    const db = await seedThrough181();
    await migrate(db, migrations);
    const before = await names(db);

    await db.execute(m188RefactorBuiltinName);

    expect(await names(db)).toEqual(before);
  });
});
