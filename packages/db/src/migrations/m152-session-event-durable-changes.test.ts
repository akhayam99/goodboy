import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = Date.parse('2026-09-11T12:00:00.000Z');

const seedThrough151 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 151),
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
    [id, 'session-1', kind, '{"questionId":"question-1"}', NOW],
  );
};

describe('m152 session event durable changes', () => {
  it('accepts the durable state change kinds next to the existing ones', async () => {
    const db = await seedThrough151();

    await migrate(db, migrations);
    await insertEvent({ db, id: 'ev-1', kind: 'session_archived' });
    await insertEvent({ db, id: 'ev-2', kind: 'session_restored' });
    await insertEvent({ db, id: 'ev-3', kind: 'write_destination_changed' });
    await insertEvent({ db, id: 'ev-4', kind: 'question_dismissed' });
    await insertEvent({ db, id: 'ev-5', kind: 'question_restored' });
    await insertEvent({ db, id: 'ev-6', kind: 'pr_merged' });

    const rows = await db.select<{ kind: string }>(
      'SELECT kind FROM session_events ORDER BY id ASC',
    );
    expect(rows.map((row) => row.kind)).toEqual([
      'session_archived',
      'session_restored',
      'write_destination_changed',
      'question_dismissed',
      'question_restored',
      'pr_merged',
    ]);
  });

  it('preserves rows written before the rebuild', async () => {
    const db = await seedThrough151();
    await insertEvent({ db, id: 'ev-old', kind: 'branch_created' });

    await migrate(db, migrations);

    const rows = await db.select<{ id: string; kind: string }>(
      'SELECT id, kind FROM session_events',
    );
    expect(rows).toEqual([{ id: 'ev-old', kind: 'branch_created' }]);
  });

  it('still refuses a kind nobody declared', async () => {
    const db = await seedThrough151();
    await migrate(db, migrations);

    await expect(insertEvent({ db, id: 'ev-bad', kind: 'session_unarchived' })).rejects.toThrow();
  });
});
