import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = Date.parse('2026-09-04T10:00:00.000Z');

const seedThrough137 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 137),
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
    [
      id,
      'session-1',
      kind,
      '{"projectId":"project-1","projectName":"api","reason":"needs a patch","agentId":"agent-1"}',
      NOW,
    ],
  );
};

describe('m138 session event materialization proposals', () => {
  it('accepts the proposed and dismissed kinds next to the mount kinds', async () => {
    const db = await seedThrough137();

    await migrate(db, migrations);
    await insertEvent({ db, id: 'ev-1', kind: 'project_materialization_proposed' });
    await insertEvent({ db, id: 'ev-2', kind: 'project_materialization_dismissed' });
    await insertEvent({ db, id: 'ev-3', kind: 'project_materialized' });

    const rows = await db.select<{ kind: string }>(
      'SELECT kind FROM session_events ORDER BY id ASC',
    );
    expect(rows.map((row) => row.kind)).toEqual([
      'project_materialization_proposed',
      'project_materialization_dismissed',
      'project_materialized',
    ]);
  });

  it('preserves rows written before the rebuild', async () => {
    const db = await seedThrough137();
    await insertEvent({ db, id: 'ev-old', kind: 'project_detached' });

    await migrate(db, migrations);

    const rows = await db.select<{ id: string; kind: string }>(
      'SELECT id, kind FROM session_events',
    );
    expect(rows).toEqual([{ id: 'ev-old', kind: 'project_detached' }]);
  });

  it('still refuses a kind nobody declared', async () => {
    const db = await seedThrough137();
    await migrate(db, migrations);

    await expect(
      insertEvent({ db, id: 'ev-bad', kind: 'project_materialization_approved' }),
    ).rejects.toThrow();
  });
});
