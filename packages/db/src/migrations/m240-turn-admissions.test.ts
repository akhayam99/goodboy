import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertRow, migrateThrough } from '../test-helpers/migration-rows';

type Database = Awaited<ReturnType<typeof makeMigratedTestDatabase>>;

const seedAgent = async ({ db }: { readonly db: Database }): Promise<void> => {
  await insertRow({
    db,
    table: 'workspaces',
    row: { id: 'w1', slug: '/tmp/harborline', name: 'Harborline', created_at: 1, updated_at: 1 },
  });
  await insertRow({
    db,
    table: 'sessions',
    row: {
      id: 's1',
      workspace_id: 'w1',
      goal: 'Northwind',
      state_kind: 'idle',
      created_at: 1,
      updated_at: 1,
    },
  });
  await insertRow({
    db,
    table: 'agents',
    row: { id: 'a1', session_id: 's1', ordinal: 0, name: 'implementer', status: 'running' },
  });
};

describe('m240 turn admissions', () => {
  it('adds an empty table keyed by agent', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 239 });
    await seedAgent({ db });

    const result = await migrateThrough({ db, version: 240 });

    expect(result.applied).toEqual([240]);
    expect(await db.select('SELECT agent_id FROM turn_admissions')).toEqual([]);
    const columns = await db.select<{ name: string }>('PRAGMA table_info(turn_admissions)');
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'agent_id',
      'run_id',
      'owner_launch',
      'claimed_at',
      'created_at',
      'updated_at',
    ]);
  });

  it('holds one claim per agent and drops it with the agent', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute('PRAGMA foreign_keys = ON');
    await seedAgent({ db });
    const claim = `INSERT INTO turn_admissions
      (id, agent_id, run_id, owner_launch, claimed_at, created_at, updated_at)
      VALUES (?, 'a1', ?, 'launch-1', 1, 1, 1)`;
    await db.execute(claim, ['admission-1', 'run-1']);

    await expect(db.execute(claim, ['admission-2', 'run-2'])).rejects.toThrow();
    await db.execute("DELETE FROM agents WHERE id = 'a1'");
    expect(await db.select('SELECT agent_id FROM turn_admissions')).toEqual([]);
  });
});
