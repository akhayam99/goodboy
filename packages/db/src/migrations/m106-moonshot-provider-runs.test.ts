import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';
const sessionId = 's-1';

const seedThrough105 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 105),
  );
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
  return db;
};

type RunParams = {
  readonly db: Database;
  readonly id: string;
  readonly provider: string;
};

const insertRun = ({ db, id, provider }: RunParams): Promise<unknown> =>
  db.execute(
    `INSERT INTO provider_runs (id, session_id, provider, model, status_kind, status_payload, created_at)
     VALUES (?, ?, ?, ?, 'pending', '{}', ?)`,
    [id, sessionId, provider, 'moonshotai/kimi-k3', Date.now()],
  );

describe('m106 moonshot provider runs', () => {
  it('rejects a moonshot run before the migration and accepts it after', async () => {
    const db = await seedThrough105();
    await expect(insertRun({ db, id: 'run-1', provider: 'moonshot' })).rejects.toThrow(
      /CHECK constraint/,
    );

    await migrate(db, migrations);
    await insertRun({ db, id: 'run-2', provider: 'moonshot' });

    const rows = await db.select<{ provider: string }>(
      'SELECT provider FROM provider_runs ORDER BY id',
    );
    expect(rows.map((row) => row.provider)).toEqual(['moonshot']);
  });

  it('carries existing rows and leaves provider validation to the type boundary', async () => {
    const db = await seedThrough105();
    await insertRun({ db, id: 'run-openrouter', provider: 'openrouter' });

    await migrate(db, migrations);

    const rows = await db.select<{ id: string }>('SELECT id FROM provider_runs');
    expect(rows.map((row) => row.id)).toEqual(['run-openrouter']);
    await insertRun({ db, id: 'run-bogus', provider: 'perplexity' });
    const providers = await db.select<{ readonly provider: string }>(
      'SELECT provider FROM provider_runs ORDER BY id',
    );
    expect(providers.map((row) => row.provider)).toEqual(['perplexity', 'openrouter']);
  });
});
