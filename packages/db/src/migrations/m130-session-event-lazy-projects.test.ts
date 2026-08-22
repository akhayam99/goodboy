import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = Date.parse('2026-08-22T10:00:00.000Z');

const seedThrough129 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 129),
  );
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('workspace-1', 'Workspace', 'workspace', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES ('session-1', 'workspace-1', 'Goal', 'idle', ?, ?)`,
    [NOW, NOW],
  );
  return db;
};

type EventParams = {
  readonly db: Database;
  readonly id: string;
  readonly kind: string;
};

const insertEvent = async ({ db, id, kind }: EventParams): Promise<void> => {
  await db.execute(
    'INSERT INTO session_events (id, session_id, kind, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, 'session-1', kind, '{"projectId":"project-1","reason":"declared by the plan"}', NOW],
  );
};

describe('m130 session event lazy projects', () => {
  it('accepts each materialization kind', async () => {
    const db = await seedThrough129();

    await migrate(db, migrations);
    await insertEvent({ db, id: 'ev-1', kind: 'project_materialized' });
    await insertEvent({ db, id: 'ev-2', kind: 'project_materialization_refused' });
    await insertEvent({ db, id: 'ev-3', kind: 'external_task_created' });

    const rows = await db.select<{ kind: string }>(
      'SELECT kind FROM session_events ORDER BY id ASC',
    );
    expect(rows.map((row) => row.kind)).toEqual([
      'project_materialized',
      'project_materialization_refused',
      'external_task_created',
    ]);
  });

  it('preserves rows written before the rebuild', async () => {
    const db = await seedThrough129();
    await insertEvent({ db, id: 'ev-old', kind: 'worktree_created' });

    await migrate(db, migrations);

    const rows = await db.select<{ id: string; kind: string }>(
      'SELECT id, kind FROM session_events',
    );
    expect(rows).toEqual([{ id: 'ev-old', kind: 'worktree_created' }]);
  });

  it('still refuses a kind nobody declared', async () => {
    const db = await seedThrough129();
    await migrate(db, migrations);

    await expect(insertEvent({ db, id: 'ev-bad', kind: 'project_dreamed' })).rejects.toThrow();
  });
});
